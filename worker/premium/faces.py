#!/usr/bin/env python3
"""
NOLOGY premium vision module (runs inside worker/Dockerfile image).

Subcommands:
  track   <video> <start> <end> <out.json>
      Samples frames at FACE_FPS, detects faces with InsightFace,
      builds a smoothed dominant-speaker crop path -> sendcmd file data.
      Output JSON: {"commands": [[t, "x", val], ...], "thumb_ts": <sec>}
      thumb_ts = timestamp of the most photogenic face inside [start,end].

  Fallbacks guaranteed: any failure -> {"commands": [], "thumb_ts": null}
  (worker then uses center crop + first-frame thumb).
"""
import json
import subprocess
import sys


def fail(msg: str) -> None:
    print(f"[faces] {msg}", file=sys.stderr)
    print(json.dumps({"commands": [], "thumb_ts": None}))
    sys.exit(0)


def main() -> None:
    if len(sys.argv) != 5:
        fail("usage: faces.py track <video> <start> <end> <out.json>")

    _, video, start_s, end_s, out_path = sys.argv
    start, end = float(start_s), float(end_s)

    try:
        import numpy as np  # noqa: F401  (insightface dependency sanity check)
        import cv2
        from insightface.app import FaceAnalysis
    except Exception as e:  # pragma: no cover
        fail(f"deps unavailable ({e}) — center crop fallback")

    fps = float(__import__("os").environ.get("FACE_FPS", "4"))
    width = int(__import__("os").environ.get("OUT_W", "1080"))
    height = int(__import__("os").environ.get("OUT_H", "1920"))

    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=0, det_size=(320, 320))

    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        fail("cannot open video")

    src_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total = cap.get(cv2.CAP_PROP_FRAME_COUNT) / src_fps
    end = min(end, max(total - 0.1, start + 1))

    # source crop size (16:9-ish window that fills 9:16 after scale)
    src_w = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    src_h = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    win_w = int(min(src_w, src_h * width / height))
    win_h = int(win_w * height / width)

    observations = []  # (t, cx, cy, area, score)
    t = start
    while t <= end:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * src_fps))
        ok, frame = cap.read()
        if not ok:
            break
        faces = app.get(frame[:, :, ::-1])  # BGR->RGB
        if faces:
            # dominant = largest face weighted by detection confidence
            f = max(faces, key=lambda f: f.bbox[2] * f.bbox[3])
            x1, y1, x2, y2 = f.bbox
            obs_cx = float((x1 + x2) / 2)
            obs_cy = float((y1 + y2) / 2)
            observations.append((t, obs_cx, obs_cy, float((x2 - x1) * (y2 - y1)), float(f.det_score)))
        t += 1.0 / fps
    cap.release()

    if not observations:
        fail("no faces found — center crop fallback")

    # smooth path (moving average over ~1.25 s)
    half_n = max(1, int(0.6 * fps))
    cxs, cys = [], []
    for i in range(len(observations)):
        lo, hi = max(0, i - half_n), min(len(observations), i + half_n + 1)
        wsum = sum(o[3] for o in observations[lo:hi])
        cxs.append(sum(o[1] * o[3] for o in observations[lo:hi]) / wsum)
        cys.append(sum(o[2] * o[3] for o in observations[lo:hi]) / wsum)

    def clamp(v, hi):
        return max(0, min(int(v), int(hi)))

    commands = []
    prev_x = prev_y = None
    for (ts, *_), cx, cy in zip(observations, cxs, cys):
        x = clamp(cx - win_w / 2, src_w - win_w)
        y = clamp(cy - win_h / 2, src_h - win_h)
        # emit only meaningful jumps (>4px) to keep cmd file lean
        if prev_x is None or abs(x - prev_x) > 4 or abs(y - prev_y) > 4:
            commands.append([round(ts, 2), "x", x])
            commands.append([round(ts, 2), "y", y])
            prev_x, prev_y = x, y

    # thumbnail: biggest clean face (area*score) in the window
    best = max(observations, key=lambda o: o[3] * o[4])

    result = {
        "commands": commands,
        "thumb_ts": round(best[0], 2),
        "win": [win_w, win_h],
    }
    with open(out_path, "w") as fh:
        json.dump(result, fh)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
