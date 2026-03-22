from __future__ import annotations


def test_train_and_predict_with_extended_gaze_features():
    from app.services.gaze_mapper import predict_gaze, train_linear_model

    points = [
        {
            "target_x": 0.15,
            "target_y": 0.20,
            "features_json": {
                "face_x_norm": 0.45,
                "face_y_norm": 0.48,
                "yaw": -4.0,
                "pitch": 2.0,
                "roll": 0.0,
                "gaze_raw_x_norm": 0.18,
                "gaze_raw_y_norm": 0.22,
            },
        },
        {
            "target_x": 0.85,
            "target_y": 0.22,
            "features_json": {
                "face_x_norm": 0.55,
                "face_y_norm": 0.47,
                "yaw": 4.0,
                "pitch": 1.0,
                "roll": 0.0,
                "gaze_raw_x_norm": 0.82,
                "gaze_raw_y_norm": 0.24,
            },
        },
        {
            "target_x": 0.50,
            "target_y": 0.50,
            "features_json": {
                "face_x_norm": 0.50,
                "face_y_norm": 0.50,
                "yaw": 0.0,
                "pitch": 0.0,
                "roll": 0.0,
                "gaze_raw_x_norm": 0.50,
                "gaze_raw_y_norm": 0.50,
            },
        },
        {
            "target_x": 0.18,
            "target_y": 0.82,
            "features_json": {
                "face_x_norm": 0.44,
                "face_y_norm": 0.55,
                "yaw": -3.0,
                "pitch": -2.0,
                "roll": 0.0,
                "gaze_raw_x_norm": 0.20,
                "gaze_raw_y_norm": 0.80,
            },
        },
        {
            "target_x": 0.84,
            "target_y": 0.80,
            "features_json": {
                "face_x_norm": 0.56,
                "face_y_norm": 0.54,
                "yaw": 3.0,
                "pitch": -2.0,
                "roll": 0.0,
                "gaze_raw_x_norm": 0.81,
                "gaze_raw_y_norm": 0.79,
            },
        },
    ]

    model, mae = train_linear_model(points)
    assert model["feature_order"][-2:] == ["gaze_raw_x_norm", "gaze_raw_y_norm"]
    assert mae < 0.05

    x, y, confidence, source = predict_gaze(
        {
            "face_x_norm": 0.51,
            "face_y_norm": 0.51,
            "yaw": 0.0,
            "pitch": 0.0,
            "roll": 0.0,
            "gaze_raw_x_norm": 0.79,
            "gaze_raw_y_norm": 0.23,
        },
        raw_guess_norm=(0.79, 0.23),
        profile_params=model,
        screen_w=None,
        screen_h=None,
    )

    assert 0.60 <= x <= 0.85
    assert 0.20 <= y <= 0.46
    assert confidence > 0.7
    assert source == "calibrated_regression"
