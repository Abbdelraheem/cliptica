#!/usr/bin/env python3
"""
NOLOGY premium vision & avatar tracking module.

Features:
  - Multi-tier detection: InsightFace SCRFD (detection-only for 5x speed)
    -> OpenCV Haar frontal & profile cascades (for sideways speakers & zero-download fallback)
    -> Motion & saliency contour tracker (for 2D/3D avatars, VTubers, webcam overlays)
  - 2-Person Podcast / Interview framing: centers between both speakers if they fit in 9:16
  - Smooth cinematic panning: dead-zone + exponential moving average (no camera jitter)
  - Zero-fail guarantee: always writes clean fallback JSON so the worker never encounters ENOENT
"""
import json
import os
import sys

def write_fallback(out_path: str, win_w: int = 1080, win_h: int = 1920) -> None:
    if not out_path:
        return
    try:
        with open(out_path, "w") as fh:
            json.dump({"commands": [], "thumb_ts": None, "win": [win_w, win_h]}, fh)
    except Exception:
        pass


def fail(msg: str, out_path: str = None, win_w: int = 1080, win_h: int = 1920) -> None:
    print(f"[faces] {msg}", file=sys.stderr)
    write_fallback(out_path, win_w, win_h)
    print(json.dumps({"commands": [], "thumb_ts": None, "win": [win_w, win_h]}))
    sys.exit(0)


def main() -> None:
    if len(sys.argv) != 5:
        fail("usage: faces.py track <video> <start> <end> <out.json>")

    _, video, start_s, end_s, out_path = sys.argv
    try:
        start, end = float(start_s), float(end_s)
    except ValueError:
        fail("invalid start/end timestamps", out_path)

    try:
        import numpy as np
        import cv2
    except Exception as e:
        fail(f"opencv/numpy unavailable ({e}) — center crop fallback", out_path)

    fps = float(os.environ.get("FACE_FPS", "4"))
    width = int(os.environ.get("OUT_W", "1080"))
    height = int(os.environ.get("OUT_H", "1920"))

    # Try initializing InsightFace with detection-only (skips heavy recognition models for 5x-10x speedup)
    insight_app = None
    try:
        from insightface.app import FaceAnalysis
        # allowed_modules=['detection'] prevents loading 4 heavy recognition/landmark models
        for model_name in ["buffalo_s", "buffalo_l"]:
            try:
                app = FaceAnalysis(name=model_name, allowed_modules=["detection"], providers=["CPUExecutionProvider"])
                app.prepare(ctx_id=0, det_size=(320, 320))
                insight_app = app
                break
            except Exception:
                continue
    except Exception as e:
        print(f"[faces] InsightFace init note: {e} (using OpenCV Haar fallback)", file=sys.stderr)

    # OpenCV Haar cascade fallback (frontal + profile for angled faces)
    haar_frontal = None
    haar_profile = None
    try:
        haar_dir = getattr(cv2, "data", None) and cv2.data.haarcascades
        if haar_dir:
            f_path = os.path.join(haar_dir, "haarcascade_frontalface_default.xml")
            p_path = os.path.join(haar_dir, "haarcascade_profileface.xml")
            if os.path.exists(f_path):
                haar_frontal = cv2.CascadeClassifier(f_path)
            if os.path.exists(p_path):
                haar_profile = cv2.CascadeClassifier(p_path)
    except Exception:
        pass

    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        fail("cannot open video", out_path)

    src_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
    total_dur = total_frames / src_fps if src_fps > 0 else 0
    if total_dur > 0:
        end = min(end, max(total_dur - 0.1, start + 0.5))

    src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1920)
    src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1080)
    win_w = int(min(src_w, src_h * width / height))
    win_h = int(win_w * height / width)

    observations = []  # (t, cx, cy, area, score)
    prev_gray = None
    last_known_cx = src_w / 2.0
    last_known_cy = src_h / 2.0
    consecutive_misses = 0

    t = start
    while t <= end:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * src_fps))
        ok, frame = cap.read()
        if not ok:
            break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        detected_boxes = []  # list of (x1, y1, x2, y2, score)

        # 1. Primary: InsightFace SCRFD
        if insight_app is not None:
            try:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                faces = insight_app.get(rgb)
                for f in (faces or []):
                    bbox = f.bbox
                    score = float(getattr(f, "det_score", 0.8))
                    if score >= 0.35:
                        detected_boxes.append((float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]), score))
            except Exception:
                pass

        # 2. Secondary: OpenCV Haar (if InsightFace found nothing or is absent)
        if not detected_boxes and haar_frontal is not None:
            small_gray = cv2.resize(gray, (0, 0), fx=0.5, fy=0.5)
            rects = haar_frontal.detectMultiScale(small_gray, scaleFactor=1.15, minNeighbors=4, minSize=(30, 30))
            for (rx, ry, rw, rh) in rects:
                detected_boxes.append((rx * 2.0, ry * 2.0, (rx + rw) * 2.0, (ry + rh) * 2.0, 0.7))
            if not detected_boxes and haar_profile is not None:
                p_rects = haar_profile.detectMultiScale(small_gray, scaleFactor=1.15, minNeighbors=4, minSize=(30, 30))
                for (rx, ry, rw, rh) in p_rects:
                    detected_boxes.append((rx * 2.0, ry * 2.0, (rx + rw) * 2.0, (ry + rh) * 2.0, 0.6))

        # 3. Tertiary: Avatar / VTuber / Gaming Streamer Webcam Fallback
        # If no human face found, detect active motion region (e.g. moving avatar / webcam overlay)
        if not detected_boxes and prev_gray is not None:
            diff = cv2.absdiff(gray, prev_gray)
            _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
            # Dilate to form coherent movement blobs
            thresh = cv2.dilate(thresh, None, iterations=2)
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            best_contour = None
            max_c_area = 0
            for c in contours:
                c_area = cv2.contourArea(c)
                # Filter out full-frame noise or tiny jitter (avatar box is usually between 2% and 35% of frame)
                if (src_w * src_h * 0.015) < c_area < (src_w * src_h * 0.45):
                    bx, by, bw, bh = cv2.boundingRect(c)
                    aspect = bw / float(bh)
                    if 0.5 <= aspect <= 2.2 and c_area > max_c_area:
                        max_c_area = c_area
                        best_contour = (bx, by, bx + bw, by + bh, 0.5)
            if best_contour:
                detected_boxes.append(best_contour)

        prev_gray = gray

        # Determine target center for this frame
        if detected_boxes:
            consecutive_misses = 0
            if len(detected_boxes) >= 2:
                # Two faces (e.g. podcast / interview):
                # Sort by area
                detected_boxes.sort(key=lambda b: (b[2] - b[0]) * (b[3] - b[1]), reverse=True)
                b1, b2 = detected_boxes[0], detected_boxes[1]
                cx1, cy1 = (b1[0] + b1[2]) / 2.0, (b1[1] + b1[3]) / 2.0
                cx2, cy2 = (b2[0] + b2[2]) / 2.0, (b2[1] + b2[3]) / 2.0
                # If both fit in the 9:16 window comfortably, center between both!
                if abs(cx1 - cx2) < win_w * 0.78:
                    obs_cx = (cx1 + cx2) / 2.0
                    obs_cy = (cy1 + cy2) / 2.0
                    area = ((b1[2] - b1[0]) * (b1[3] - b1[1])) + ((b2[2] - b2[0]) * (b2[3] - b2[1]))
                    score = (b1[4] + b2[4]) / 2.0
                else:
                    # Too far apart: lock onto the dominant or closest to previous view
                    dist1 = abs(cx1 - last_known_cx)
                    dist2 = abs(cx2 - last_known_cx)
                    chosen = b1 if dist1 <= dist2 else b2
                    obs_cx = (chosen[0] + chosen[2]) / 2.0
                    obs_cy = (chosen[1] + chosen[3]) / 2.0
                    area = (chosen[2] - chosen[0]) * (chosen[3] - chosen[1])
                    score = chosen[4]
            else:
                chosen = detected_boxes[0]
                obs_cx = (chosen[0] + chosen[2]) / 2.0
                obs_cy = (chosen[1] + chosen[3]) / 2.0
                area = (chosen[2] - chosen[0]) * (chosen[3] - chosen[1])
                score = chosen[4]

            last_known_cx = obs_cx
            last_known_cy = obs_cy
            observations.append((t, obs_cx, obs_cy, area, score))
        else:
            consecutive_misses += 1
            # If temporarily missed (<1.5s), carry forward last known position with gentle drift
            if consecutive_misses <= int(fps * 1.5) and observations:
                observations.append((t, last_known_cx, last_known_cy, win_w * win_h * 0.05, 0.4))

        t += 1.0 / fps

    cap.release()

    if not observations:
        fail("no faces or active avatars detected — center crop fallback", out_path, win_w, win_h)

    # Smooth path: Adaptive moving average over ~1.2s to eliminate camera vibration
    half_n = max(1, int(0.6 * fps))
    cxs, cys = [], []
    for i in range(len(observations)):
        lo = max(0, i - half_n)
        hi = min(len(observations), i + half_n + 1)
        wsum = sum(o[3] for o in observations[lo:hi]) or 1.0
        cxs.append(sum(o[1] * o[3] for o in observations[lo:hi]) / wsum)
        cys.append(sum(o[2] * o[3] for o in observations[lo:hi]) / wsum)

    def clamp(v, hi):
        return max(0, min(int(v), int(hi)))

    commands = []
    prev_x = None
    prev_y = None
    # Dead-zone threshold: 8px to prevent micro-jitter
    dead_zone = 8

    for (ts, *_), cx, cy in zip(observations, cxs, cys):
        x = clamp(cx - win_w / 2.0, src_w - win_w)
        y = clamp(cy - win_h / 2.0, src_h - win_h)

        if prev_x is None or abs(x - prev_x) >= dead_zone or abs(y - prev_y) >= dead_zone:
            commands.append([round(ts, 2), "x", x])
            commands.append([round(ts, 2), "y", y])
            prev_x, prev_y = x, y

    # Best frame for thumbnail: highest confidence * area face
    best = max(observations, key=lambda o: o[3] * o[4])

    result = {
        "commands": commands,
        "thumb_ts": round(best[0], 2),
        "win": [win_w, win_h],
    }

    try:
        with open(out_path, "w") as fh:
            json.dump(result, fh)
    except Exception as e:
        print(f"[faces] warning writing out_path: {e}", file=sys.stderr)

    print(json.dumps(result))


if __name__ == "__main__":
    main()

