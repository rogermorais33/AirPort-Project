from __future__ import annotations

import argparse
import pathlib
import urllib.request

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
    "face_landmarker/float16/latest/face_landmarker.task"
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Download MediaPipe Face Landmarker task model")
    parser.add_argument(
        "--output",
        default="models/face_landmarker.task",
        help="Output path for downloaded model",
    )
    parser.add_argument(
        "--url",
        default=MODEL_URL,
        help="Model URL",
    )
    args = parser.parse_args()

    output = pathlib.Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    print(f"Downloading model from: {args.url}")
    urllib.request.urlretrieve(args.url, output)
    print(f"Saved model to: {output.resolve()}")


if __name__ == "__main__":
    main()
