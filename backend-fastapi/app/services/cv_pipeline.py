from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from app.core.config import get_settings

settings = get_settings()

try:
    import cv2
except Exception:  # pragma: no cover - handled by fallback path
    cv2 = None

try:
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision as mp_vision
except Exception:  # pragma: no cover - handled by fallback path
    mp = None
    mp_python = None
    mp_vision = None


@dataclass(slots=True)
class CVResult:
    face_detected: bool
    confidence: float
    yaw: float
    pitch: float
    roll: float
    blink: bool
    eye_left: dict[str, float]
    eye_right: dict[str, float]
    features: dict[str, float]
    raw_gaze_norm: tuple[float, float]
    backend: str


class CVPipeline:
    def __init__(self) -> None:
        self._backend_requested = settings.cv_backend.lower().strip()
        if self._backend_requested not in {"auto", "mediapipe", "opencv"}:
            self._backend_requested = "auto"

        self._cascade = None
        self._landmarker = None
        self._mediapipe_error: str | None = None
        self._mediapipe_model_path = settings.cv_mediapipe_model_path

        if cv2 is not None:
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            self._cascade = cv2.CascadeClassifier(cascade_path)

        if self._backend_requested in {"auto", "mediapipe"}:
            self._initialize_mediapipe()

    def diagnostics(self) -> dict[str, Any]:
        active_backend = "none"
        if self._landmarker is not None:
            active_backend = "mediapipe"
        elif self._cascade is not None:
            active_backend = "opencv"

        return {
            "cv_backend_requested": self._backend_requested,
            "cv_backend_active": active_backend,
            "mediapipe_available": self._landmarker is not None,
            "mediapipe_model": self._mediapipe_model_path if self._landmarker is not None else None,
            "mediapipe_error": self._mediapipe_error,
        }

    def process_jpeg(self, frame_bytes: bytes) -> CVResult:
        if cv2 is None:
            return self._fallback_result(backend="none")

        arr = np.frombuffer(frame_bytes, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None or frame.size == 0:
            return self._fallback_result(backend="none")

        if self._landmarker is not None:
            mp_result = self._process_with_mediapipe(frame)
            if mp_result.face_detected:
                return mp_result

        if self._cascade is not None and self._backend_requested != "mediapipe":
            return self._process_with_haar(frame)

        return self._fallback_result(backend="none")

    def _initialize_mediapipe(self) -> None:
        if mp is None or mp_python is None or mp_vision is None:
            self._mediapipe_error = "mediapipe package not installed"
            return

        model_path = Path(self._mediapipe_model_path)
        if not model_path.exists():
            self._mediapipe_error = f"mediapipe model not found at {model_path}"
            return

        try:
            options = mp_vision.FaceLandmarkerOptions(
                base_options=mp_python.BaseOptions(model_asset_path=str(model_path)),
                running_mode=mp_vision.RunningMode.IMAGE,
                num_faces=1,
                output_face_blendshapes=True,
                output_facial_transformation_matrixes=True,
                min_face_detection_confidence=settings.cv_min_face_detection_confidence,
                min_face_presence_confidence=settings.cv_min_face_presence_confidence,
                min_tracking_confidence=settings.cv_min_tracking_confidence,
            )
            self._landmarker = mp_vision.FaceLandmarker.create_from_options(options)
            self._mediapipe_error = None
        except Exception as exc:  # pragma: no cover - defensive path for runtime envs
            self._landmarker = None
            self._mediapipe_error = str(exc)

    def _process_with_mediapipe(self, frame_bgr: np.ndarray) -> CVResult:
        assert cv2 is not None
        assert self._landmarker is not None
        assert mp is not None

        h, w = frame_bgr.shape[:2]
        if h <= 0 or w <= 0:
            return self._fallback_result(backend="mediapipe")

        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

        detection = self._landmarker.detect(mp_image)
        if not detection.face_landmarks:
            return self._fallback_result(backend="mediapipe")

        landmarks = detection.face_landmarks[0]
        if len(landmarks) < 292:
            return self._fallback_result(backend="mediapipe")

        nose = _lm_norm(landmarks, 1)
        face_x_norm = float(_clamp(nose[0], 0.0, 1.0))
        face_y_norm = float(_clamp(nose[1], 0.0, 1.0))

        pnp_ok, yaw, pitch, roll = _estimate_head_pose_solvepnp(landmarks, w, h)

        eye_left = _eye_center(landmarks, [33, 133])
        eye_right = _eye_center(landmarks, [362, 263])

        blink = _detect_blink_ear(landmarks)

        raw_gaze_norm = _estimate_gaze_from_iris_or_pose(landmarks, yaw=yaw, pitch=pitch)

        confidence = 0.62
        if pnp_ok:
            confidence += 0.18
        if detection.face_blendshapes and len(detection.face_blendshapes[0]) > 0:
            confidence += min(0.16, float(np.mean([c.score for c in detection.face_blendshapes[0][:8]])))
        confidence = float(_clamp(confidence, 0.0, 0.99))

        return CVResult(
            face_detected=True,
            confidence=confidence,
            yaw=float(_clamp(yaw, -45.0, 45.0)),
            pitch=float(_clamp(pitch, -35.0, 35.0)),
            roll=float(_clamp(roll, -25.0, 25.0)),
            blink=blink,
            eye_left={"x": float(_clamp(eye_left[0], 0.0, 1.0)), "y": float(_clamp(eye_left[1], 0.0, 1.0))},
            eye_right={"x": float(_clamp(eye_right[0], 0.0, 1.0)), "y": float(_clamp(eye_right[1], 0.0, 1.0))},
            features={
                "face_x_norm": face_x_norm,
                "face_y_norm": face_y_norm,
                "yaw": float(yaw),
                "pitch": float(pitch),
                "roll": float(roll),
                "blink": 1.0 if blink else 0.0,
            },
            raw_gaze_norm=raw_gaze_norm,
            backend="mediapipe",
        )

    def _process_with_haar(self, frame_bgr: np.ndarray) -> CVResult:
        assert cv2 is not None

        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        faces = self._cascade.detectMultiScale(
            gray,
            scaleFactor=1.12,
            minNeighbors=5,
            minSize=(60, 60),
        )

        h, w = gray.shape[:2]
        if len(faces) == 0:
            return self._fallback_result(backend="opencv")

        x, y, fw, fh = max(faces, key=lambda item: item[2] * item[3])
        cx = x + fw / 2.0
        cy = y + fh / 2.0

        face_x_norm = _clamp(cx / max(w, 1), 0.0, 1.0)
        face_y_norm = _clamp(cy / max(h, 1), 0.0, 1.0)

        yaw = _clamp((face_x_norm - 0.5) * 60.0, -45.0, 45.0)
        pitch = _clamp((0.5 - face_y_norm) * 50.0, -35.0, 35.0)
        roll = _estimate_roll(gray, x, y, fw, fh)

        area_ratio = (fw * fh) / float(max(w * h, 1))
        confidence = _clamp(0.45 + area_ratio * 4.5, 0.0, 0.95)

        eye_left = {
            "x": float(_clamp(face_x_norm - 0.08, 0.0, 1.0)),
            "y": float(_clamp(face_y_norm - 0.04, 0.0, 1.0)),
        }
        eye_right = {
            "x": float(_clamp(face_x_norm + 0.08, 0.0, 1.0)),
            "y": float(_clamp(face_y_norm - 0.04, 0.0, 1.0)),
        }

        blink = _detect_blink_brightness(gray, x, y, fw, fh)

        raw_gaze_x = float(_clamp(0.5 + yaw / 65.0, 0.0, 1.0))
        raw_gaze_y = float(_clamp(0.5 - pitch / 50.0, 0.0, 1.0))

        return CVResult(
            face_detected=True,
            confidence=float(confidence),
            yaw=float(yaw),
            pitch=float(pitch),
            roll=float(roll),
            blink=blink,
            eye_left=eye_left,
            eye_right=eye_right,
            features={
                "face_x_norm": float(face_x_norm),
                "face_y_norm": float(face_y_norm),
                "yaw": float(yaw),
                "pitch": float(pitch),
                "roll": float(roll),
                "blink": 1.0 if blink else 0.0,
            },
            raw_gaze_norm=(raw_gaze_x, raw_gaze_y),
            backend="opencv",
        )

    @staticmethod
    def _fallback_result(backend: str) -> CVResult:
        return CVResult(
            face_detected=False,
            confidence=0.0,
            yaw=0.0,
            pitch=0.0,
            roll=0.0,
            blink=False,
            eye_left={},
            eye_right={},
            features={
                "face_x_norm": 0.5,
                "face_y_norm": 0.5,
                "yaw": 0.0,
                "pitch": 0.0,
                "roll": 0.0,
                "blink": 0.0,
            },
            raw_gaze_norm=(0.5, 0.5),
            backend=backend,
        )


def _estimate_head_pose_solvepnp(
    landmarks: list[Any],
    frame_w: int,
    frame_h: int,
) -> tuple[bool, float, float, float]:
    assert cv2 is not None

    model_points = np.array(
        [
            (0.0, 0.0, 0.0),
            (0.0, -63.6, -12.5),
            (-43.3, 32.7, -26.0),
            (43.3, 32.7, -26.0),
            (-28.9, -28.9, -24.1),
            (28.9, -28.9, -24.1),
        ],
        dtype=np.float64,
    )

    image_points = np.array(
        [
            _lm_px(landmarks, 1, frame_w, frame_h),
            _lm_px(landmarks, 152, frame_w, frame_h),
            _lm_px(landmarks, 33, frame_w, frame_h),
            _lm_px(landmarks, 263, frame_w, frame_h),
            _lm_px(landmarks, 61, frame_w, frame_h),
            _lm_px(landmarks, 291, frame_w, frame_h),
        ],
        dtype=np.float64,
    )

    focal = max(float(frame_w), float(frame_h))
    camera_matrix = np.array(
        [
            [focal, 0.0, frame_w / 2.0],
            [0.0, focal, frame_h / 2.0],
            [0.0, 0.0, 1.0],
        ],
        dtype=np.float64,
    )

    dist_coeffs = np.zeros((4, 1), dtype=np.float64)

    success, rotation_vector, translation_vector = cv2.solvePnP(
        model_points,
        image_points,
        camera_matrix,
        dist_coeffs,
        flags=cv2.SOLVEPNP_ITERATIVE,
    )

    if not success:
        return False, 0.0, 0.0, 0.0

    rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
    pitch, yaw, roll = _rotation_matrix_to_euler(rotation_matrix)

    return True, float(yaw), float(pitch), float(roll)


def _rotation_matrix_to_euler(rotation_matrix: np.ndarray) -> tuple[float, float, float]:
    sy = np.sqrt(rotation_matrix[0, 0] ** 2 + rotation_matrix[1, 0] ** 2)
    singular = sy < 1e-6

    if not singular:
        x = np.arctan2(rotation_matrix[2, 1], rotation_matrix[2, 2])
        y = np.arctan2(-rotation_matrix[2, 0], sy)
        z = np.arctan2(rotation_matrix[1, 0], rotation_matrix[0, 0])
    else:
        x = np.arctan2(-rotation_matrix[1, 2], rotation_matrix[1, 1])
        y = np.arctan2(-rotation_matrix[2, 0], sy)
        z = 0.0

    pitch = float(np.degrees(x))
    yaw = float(np.degrees(y))
    roll = float(np.degrees(z))
    return pitch, yaw, roll


def _eye_center(landmarks: list[Any], indexes: list[int]) -> tuple[float, float]:
    xs = [float(landmarks[idx].x) for idx in indexes]
    ys = [float(landmarks[idx].y) for idx in indexes]
    return float(np.mean(xs)), float(np.mean(ys))


def _detect_blink_ear(landmarks: list[Any]) -> bool:
    left_eye = [33, 160, 158, 133, 153, 144]
    right_eye = [362, 385, 387, 263, 373, 380]

    left_ear = _eye_aspect_ratio(landmarks, left_eye)
    right_ear = _eye_aspect_ratio(landmarks, right_eye)

    ear = (left_ear + right_ear) / 2.0
    return ear < settings.cv_blink_ear_threshold


def _eye_aspect_ratio(landmarks: list[Any], idx: list[int]) -> float:
    p1 = _lm_vec(landmarks, idx[0])
    p2 = _lm_vec(landmarks, idx[1])
    p3 = _lm_vec(landmarks, idx[2])
    p4 = _lm_vec(landmarks, idx[3])
    p5 = _lm_vec(landmarks, idx[4])
    p6 = _lm_vec(landmarks, idx[5])

    vertical = np.linalg.norm(p2 - p6) + np.linalg.norm(p3 - p5)
    horizontal = max(np.linalg.norm(p1 - p4), 1e-6)
    return float(vertical / (2.0 * horizontal))


def _estimate_gaze_from_iris_or_pose(
    landmarks: list[Any],
    *,
    yaw: float,
    pitch: float,
) -> tuple[float, float]:
    has_iris = len(landmarks) > 473
    if has_iris:
        left_inner = _lm_norm(landmarks, 133)
        left_outer = _lm_norm(landmarks, 33)
        right_inner = _lm_norm(landmarks, 362)
        right_outer = _lm_norm(landmarks, 263)

        left_top = _lm_norm(landmarks, 159)
        left_bottom = _lm_norm(landmarks, 145)
        right_top = _lm_norm(landmarks, 386)
        right_bottom = _lm_norm(landmarks, 374)

        left_iris = _lm_norm(landmarks, 468)
        right_iris = _lm_norm(landmarks, 473)

        left_h = _ratio(left_iris[0], min(left_inner[0], left_outer[0]), max(left_inner[0], left_outer[0]))
        right_h = _ratio(right_iris[0], min(right_inner[0], right_outer[0]), max(right_inner[0], right_outer[0]))
        left_v = _ratio(left_iris[1], min(left_top[1], left_bottom[1]), max(left_top[1], left_bottom[1]))
        right_v = _ratio(right_iris[1], min(right_top[1], right_bottom[1]), max(right_top[1], right_bottom[1]))

        return float(_clamp((left_h + right_h) / 2.0, 0.0, 1.0)), float(
            _clamp((left_v + right_v) / 2.0, 0.0, 1.0)
        )

    return float(_clamp(0.5 + yaw / 65.0, 0.0, 1.0)), float(_clamp(0.5 - pitch / 50.0, 0.0, 1.0))


def _estimate_roll(gray: Any, x: int, y: int, fw: int, fh: int) -> float:
    assert cv2 is not None

    top = gray[max(y, 0) : max(y + fh // 3, 1), max(x, 0) : max(x + fw, 1)]
    if top.size == 0:
        return 0.0
    moments = cv2.moments(top)
    if abs(moments["mu20"] - moments["mu02"]) < 1e-6:
        return 0.0
    angle = 0.5 * np.arctan2(2 * moments["mu11"], moments["mu20"] - moments["mu02"])
    return float(_clamp(np.degrees(angle), -20.0, 20.0))


def _detect_blink_brightness(gray: Any, x: int, y: int, fw: int, fh: int) -> bool:
    eyes_band = gray[max(y, 0) : max(y + fh // 3, 1), max(x, 0) : max(x + fw, 1)]
    if eyes_band.size == 0:
        return False
    return float(np.mean(eyes_band)) < 55.0


def _lm_px(landmarks: list[Any], idx: int, frame_w: int, frame_h: int) -> np.ndarray:
    lm = landmarks[idx]
    return np.array([float(lm.x) * frame_w, float(lm.y) * frame_h], dtype=np.float64)


def _lm_norm(landmarks: list[Any], idx: int) -> tuple[float, float]:
    lm = landmarks[idx]
    return float(lm.x), float(lm.y)


def _lm_vec(landmarks: list[Any], idx: int) -> np.ndarray:
    lm = landmarks[idx]
    return np.array([float(lm.x), float(lm.y)], dtype=np.float64)


def _ratio(value: float, min_value: float, max_value: float) -> float:
    span = max(max_value - min_value, 1e-6)
    return (value - min_value) / span


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))
