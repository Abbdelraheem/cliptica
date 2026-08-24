# NOLOGY premium worker image
# Runs the Node orchestrator (worker.mjs) + Python vision stack side-by-side.
#
#   docker build -t nology-worker -f worker/Dockerfile .
#   docker run --env-file .env.production nology-worker
#
# Works CPU-only (Oracle ARM free tier, slower face pass) or on GPU pods
# (RunPod/Vast RTX 4090 — set ONNX providers via CUDA image tag if desired).

FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg python3 python3-pip python3-venv curl awscli ca-certificates \
    fonts-dejavu-core libglib2.0-0 libgl1 \
  && rm -rf /var/lib/apt/lists/*

# yt-dlp (arch-agnostic wheel install)
RUN pip3 install --break-system-packages yt-dlp

# Premium vision stack: face detection + tracking (~600 MB)
RUN pip3 install --break-system-packages \
    numpy opencv-python-headless onnxruntime insightface

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --silent || npm install --silent
COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production \
    PIPELINE_PREMIUM=1 \
    FACE_FPS=4 \
    OUT_W=1080 \
    OUT_H=1920

CMD ["node", "--env-file=/app/.env.production", "worker/worker.mjs"]
