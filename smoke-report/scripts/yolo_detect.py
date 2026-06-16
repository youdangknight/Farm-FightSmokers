import json
import sys
from pathlib import Path

from ultralytics import YOLO, YOLOWorld


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "missing image path"}))
        return 1

    image_path = Path(sys.argv[1])
    model_name = sys.argv[2] if len(sys.argv) > 2 else "yolov8n.pt"
    classes = [item.strip() for item in sys.argv[3].split(",")] if len(sys.argv) > 3 and sys.argv[3].strip() else []

    if "world" in model_name:
        model = YOLOWorld(model_name)
        if classes:
            model.set_classes(classes)
    else:
        model = YOLO(model_name)

    results = model(str(image_path), verbose=False)
    result = results[0]

    detections = []
    if result.boxes is not None:
      for box in result.boxes:
          class_id = int(box.cls[0])
          x1, y1, x2, y2 = [float(value) for value in box.xyxy[0].tolist()]
          detections.append(
              {
                  "label": result.names[class_id],
                  "classId": class_id,
                  "confidence": float(box.conf[0]),
                  "x": x1,
                  "y": y1,
                  "width": x2 - x1,
                  "height": y2 - y1,
              }
          )

    print(json.dumps({"ok": True, "model": model_name, "detections": detections}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
