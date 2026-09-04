# NOLOGY Multi-stage Dockerfile
# ============================================================
# Stage 1: Base dependencies (shared)
# Stage 2: Web builder (Next.js)
# Stage 3: Worker runtime (Node + Python + FFmpeg + InsightFace)
# Stage 4: Web runtime (Next.js standalone)
# Stage 5: Production image (web + worker combined)

# ============================================================
# STAGE 1: Base - Common dependencies
# ============================================================
FROM node:20-slim AS base

# Install system dependencies
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends \
    ca-certificates \
    curl \
    git \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    libvips \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp (ARM64 and x86_64)
ARG TARGETARCH
RUN curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_${TARGETARCH}" \
    -o /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp && \
    yt-dlp --version

# Create app directory
WORKDIR /opt/nology

# ============================================================
# STAGE 2: Python dependencies for worker (InsightFace + faster-whisper)
# ============================================================
FROM base AS python-deps

# Install Python build dependencies
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends \
    python3-dev \
    build-essential \
    cmake \
    libopenblas-dev \
    libomp-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python3 -m venv /opt/nology-venv
ENV PATH="/opt/nology-venv/bin:$PATH"

# Install Python dependencies
RUN /opt/nology-venv/bin/pip install -q --upgrade pip && \
    /opt/nology-venv/bin/pip install -q --no-cache-dir \
    faster-whisper \
    insightface \
    opencv-python-headless \
    onnxruntime \
    numpy \
    onnx

# ============================================================
# STAGE 3: Build web application (Next.js)
# ============================================================
FROM base AS web-builder

WORKDIR /opt/nology

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (including dev for build)
RUN npm ci --silent

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY . .

# Build Next.js application
RUN npm run build

# ============================================================
# STAGE 4: Web runtime (standalone Next.js)
# ============================================================
FROM node:20-slim AS web-runtime

# Install runtime dependencies
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/nology

# Copy standalone build output
COPY --from=web-builder /opt/nology/.next/standalone ./
COPY --from=web-builder /opt/nology/.next/static ./.next/static
COPY --from=web-builder /opt/nology/public ./public
COPY --from=web-builder /opt/nology/node_modules/.prisma/client ./node_modules/.prisma/client
COPY --from=web-builder /opt/nology/node_modules/@prisma ./node_modules/@prisma
COPY --from=web-builder /opt/nology/node_modules/@tanstack ./node_modules/@tanstack
COPY --from=web-builder /opt/nology/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=web-builder /opt/nology/node_modules/zod ./node_modules/zod
COPY --from=web-builder /opt/nology/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=web-builder /opt/nology/node_modules/next-auth ./node_modules/next-auth
COPY --from=web-builder /opt/nology/node_modules/stripe ./node_modules/stripe
COPY --from=web-builder /opt/nology/node_modules/@upstash ./node_modules/@upstash
COPY --from=web-builder /opt/nology/node_modules/@sentry ./node_modules/@sentry
COPY --from=web-builder /opt/nology/node_modules/@prisma ./node_modules/@prisma
COPY --from=web-builder /opt/nology/node_modules/zod ./node_modules/zod
COPY --from=web-builder /opt/nology/node_modules/@tanstack ./node_modules/@tanstack
COPY --from=web-builder /opt/nology/node_modules/clsx ./node_modules/clsx
COPY --from=web-builder /opt/nology/node_modules/tailwind-merge ./node_modules/tailwind-merge
COPY --from=web-builder /opt/nology/node_modules/class-variance-authority ./node_modules/class-variance-authority
COPY --from=web-builder /opt/nology/node_modules/lucide-react ./node_modules/lucide-react
COPY --from=web-builder /opt/nology/node_modules/sonner ./node_modules/sonner
COPY --from=web-builder /opt/nology/node_modules/next-themes ./node_modules/next-themes
COPY --from=web-builder /opt/nology/node_modules/@radix-ui ./node_modules/@radix-ui
COPY --from=web-builder /opt/nology/node_modules/jiti ./node_modules/jiti
COPY --from=web-builder /opt/nology/node_modules/enhanced-resolve ./node_modules/enhanced-resolve

# ============================================================
# STAGE 5: Worker runtime (Node + Python + FFmpeg + InsightFace)
# ============================================================
FROM python-deps AS worker-runtime

# Copy worker files
COPY worker/ /opt/nology/worker/
COPY prisma/ /opt/nology/prisma/

# Install Prisma client in venv
RUN /opt/nology-venv/bin/pip install -q prisma-client-py

# Generate Prisma client
RUN npx prisma generate

# Set Python path
ENV PATH="/opt/nology-venv/bin:$PATH"
ENV PYTHONPATH="/opt/nology:/opt/nology/worker"

# ============================================================
# STAGE 5: Production combined image
# ============================================================
FROM node:20-slim AS production

# Install runtime dependencies
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    python3 \
    python3-venv \
    libvips \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
ARG TARGETARCH
RUN curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_${TARGETARCH}" \
    -o /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp && \
    yt-dlp --version

# Create virtual environment with InsightFace
RUN python3 -m venv /opt/nology-venv
ENV PATH="/opt/nology-venv/bin:$PATH"
RUN /opt/nology-venv/bin/pip install -q --upgrade pip && \
    /opt/nology-venv/bin/pip install -q --no-cache-dir \
    faster-whisper \
    insightface \
    opencv-python-headless \
    onnxruntime \
    numpy \
    onnx

# Install yt-dlp
RUN curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64" \
    -o /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp

# Copy web runtime
COPY --from=web-runtime /opt/nology /opt/nology

# Copy worker files
COPY worker/ /opt/nology/worker/
COPY prisma/ /opt/nology/prisma/

# Copy Python venv from python-deps stage
COPY --from=python-deps /opt/nology-venv /opt/nology-venv

# Set Python path
ENV PATH="/opt/nology-venv/bin:$PATH"
ENV PYTHONPATH="/opt/nology:/opt/nology/worker"

# Create log directories
RUN mkdir -p /var/log/nology

# Generate Prisma client
RUN npx prisma generate

WORKDIR /opt/nology

# Expose ports
EXPOSE 3000

# Default command (PM2 will manage processes)
CMD ["pm2-runtime", "deploy/pm2.ecosystem.config.cjs"]