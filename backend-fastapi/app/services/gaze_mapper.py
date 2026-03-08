from __future__ import annotations

from typing import Any

import numpy as np

FEATURE_ORDER = ["bias", "face_x_norm", "face_y_norm", "yaw", "pitch", "roll"]


def feature_vector(features: dict[str, float]) -> np.ndarray:
    return np.array(
        [
            1.0,
            float(features.get("face_x_norm", 0.5)),
            float(features.get("face_y_norm", 0.5)),
            float(features.get("yaw", 0.0)),
            float(features.get("pitch", 0.0)),
            float(features.get("roll", 0.0)),
        ],
        dtype=float,
    )


def train_linear_model(points: list[dict[str, Any]]) -> tuple[dict[str, Any], float]:
    if len(points) < 5:
        raise ValueError("At least 5 calibration points are required")

    x_rows: list[np.ndarray] = []
    y_targets: list[list[float]] = []

    for point in points:
        feat = point.get("features_json") or {}
        target_x = float(point.get("target_x", 0.5))
        target_y = float(point.get("target_y", 0.5))
        x_rows.append(feature_vector(feat))
        y_targets.append([target_x, target_y])

    x = np.vstack(x_rows)
    y = np.array(y_targets)

    coef, _, _, _ = np.linalg.lstsq(x, y, rcond=None)
    predictions = x @ coef
    mae = float(np.mean(np.abs(predictions - y)))

    model = {
        "model_type": "linear_regression",
        "feature_order": FEATURE_ORDER,
        "coefficients": coef.tolist(),
        "training_mae": mae,
    }
    return model, mae


def predict_gaze(
    features: dict[str, float],
    *,
    raw_guess_norm: tuple[float, float],
    profile_params: dict[str, Any] | None,
    screen_w: int | None,
    screen_h: int | None,
) -> tuple[float, float, float, str]:
    source = "headpose"
    confidence = 0.55

    gx_norm, gy_norm = raw_guess_norm

    if profile_params and profile_params.get("coefficients"):
        coef = np.array(profile_params["coefficients"], dtype=float)
        vec = feature_vector(features)
        pred = vec @ coef
        gx_norm = float(np.clip(pred[0], 0.0, 1.0))
        gy_norm = float(np.clip(pred[1], 0.0, 1.0))
        mae = float(profile_params.get("training_mae", 0.2))
        confidence = float(np.clip(1.0 - mae, 0.2, 0.98))
        source = "calibrated_regression"

    if screen_w and screen_h:
        x = float(np.clip(gx_norm * screen_w, 0.0, screen_w))
        y = float(np.clip(gy_norm * screen_h, 0.0, screen_h))
    else:
        x = gx_norm
        y = gy_norm

    return x, y, confidence, source
