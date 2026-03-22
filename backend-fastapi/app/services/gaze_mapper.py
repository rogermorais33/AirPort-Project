from __future__ import annotations

from typing import Any

import numpy as np

FEATURE_ORDER = ["bias", "face_x_norm", "face_y_norm", "yaw", "pitch", "roll", "gaze_raw_x_norm", "gaze_raw_y_norm"]


def feature_vector_for_order(features: dict[str, float], feature_order: list[str]) -> np.ndarray:
    values: list[float] = []
    for name in feature_order:
        if name == "bias":
            values.append(1.0)
        else:
            values.append(float(features.get(name, 0.0)))
    return np.array(values, dtype=float)


def feature_vector(features: dict[str, float]) -> np.ndarray:
    defaults = {
        "face_x_norm": 0.5,
        "face_y_norm": 0.5,
        "yaw": 0.0,
        "pitch": 0.0,
        "roll": 0.0,
        "gaze_raw_x_norm": 0.5,
        "gaze_raw_y_norm": 0.5,
    }
    normalized = {**defaults, **features}
    return feature_vector_for_order(normalized, FEATURE_ORDER)


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

    ridge_lambda = 1e-3
    regularizer = ridge_lambda * np.eye(x.shape[1], dtype=float)
    regularizer[0, 0] = 0.0
    coef = np.linalg.solve(x.T @ x + regularizer, x.T @ y)
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
        feature_order = list(profile_params.get("feature_order") or FEATURE_ORDER)
        vec = feature_vector_for_order(
            {
                "face_x_norm": float(features.get("face_x_norm", 0.5)),
                "face_y_norm": float(features.get("face_y_norm", 0.5)),
                "yaw": float(features.get("yaw", 0.0)),
                "pitch": float(features.get("pitch", 0.0)),
                "roll": float(features.get("roll", 0.0)),
                "gaze_raw_x_norm": float(features.get("gaze_raw_x_norm", raw_guess_norm[0])),
                "gaze_raw_y_norm": float(features.get("gaze_raw_y_norm", raw_guess_norm[1])),
            },
            feature_order,
        )
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
