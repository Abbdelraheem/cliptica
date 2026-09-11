# Cliptica — Infrastructure & Production Specifications
**Measured Date**: 2026-09-11  
**Environment**: AWS EC2 Production Host  
**Authority**: Role 4 — The Creator  

---

## 1. Physical Host Specifications
- **Cloud Provider**: Amazon Web Services (AWS) EC2
- **Instance Public IP**: `13.62.192.145`
- **Operating System**: Ubuntu 24.04.1 LTS (Linux 6.8.0-1018-aws x86_64)
- **Host Uptime**: 5 days, 23+ hours (Clean continuous operation, Load Avg: 0.00, 0.00, 0.00)
- **Processor**: Intel(R) Xeon(R) Platinum 8488C
  - **vCPUs**: 2 vCPUs (1 socket, 1 core per socket, 2 threads per core)
  - **Virtualization**: KVM full virtualization
  - **AVX/VNNI Extensions**: Full AVX-512 and AVX-VNNI support enabled (utilized by FFmpeg and faster-whisper)
- **Memory**:
  - **Total Physical RAM**: 7.6 GiB (8,192 MB)
  - **Used Memory**: 934 MiB (~12% utilization)
  - **Free Memory**: 2.9 GiB
  - **Buff/Cache**: 4.1 GiB (Kernel file caching for high-throughput video I/O)
  - **Available Memory**: 6.7 GiB headroom
  - **Swap**: 0B configured (Zero paging delays)
- **Storage**:
  - **Root Filesystem**: `/dev/root` on EBS GP3 volume (38 GB capacity)
  - **Used Space**: 11 GB (28% disk utilization)
  - **Available Space**: 28 GB free storage
  - **Temporary Scratch Space**: `/tmp` on root filesystem with 1-hour automated orphan directory sweeper in worker.

---

## 2. Process Architecture & Live Resource Consumption

All services run under PM2 (`v7.0.4`) managed with systemd under the `root` context:

| Process Name | Process ID | Memory Footprint | CPU Idle | Role & Responsibilities |
|---|---|---|---|---|
| **`nology-web`** | 919295 | ~229.2 MiB | 0.0% | Next.js 15.5.25 standalone server serving App Router, React 19 UI, and 39 API routes. |
| **`nology-worker`** | 919325 | ~89.9 MiB | 0.2% | Node.js asynchronous job consumer handling yt-dlp, Groq Whisper, LLM scoring, FFmpeg filter graph rendering, and R2 uploads. |
| **`nology-bot`** | 757263 | ~79.7 MiB | 0.0% | Telegram bot webhook daemon for creator alerts and command-line status updates. |
| **`pm2-logrotate`** | 10712 | ~66.4 MiB | 0.0% | Log rotation module maintaining application stdout/stderr logs under `/root/.pm2/logs`. |

---

## 3. Worker Throughput & Scaling Ceilings

### Parallelism & Memory Envelope
- **`RENDER_PARALLEL`**: Configured to `4` parallel FFmpeg rendering lanes.
- **FFmpeg Concurrency Impact**:
  - Each 1080x1920 / 1080x1080 FFmpeg H.264 encode consumes ~150–220 MB RAM and ~60–80% CPU during active encoding bursts.
  - 4 concurrent encodes peak at ~800 MB RAM, comfortably within the 6.7 GiB available headroom.
- **Rendering Throughput**:
  - Clip generation (6 clips from a 10-minute video): ~45–60 seconds total.
  - Clip adjustment (re-trimming cached source): ~7.99 seconds total.
- **Monthly Capacity Estimate**:
  - At 60s per video processing cycle, a single 2-vCPU node can process **1,440 long-form videos per day** or **~43,000 videos per month** at 100% saturation.

---

## 4. Operational Safety Controls
- **Stale Job Recovery**: Sweeps every 5 minutes (`stale_job_minutes` default: 30m). Crashed jobs automatically requeued.
- **Disk Protection**:
  - Orphan directories in `/tmp/nology-*` purged after 60 minutes.
  - Source video cache `/tmp/nology-sources/*.mp4` purged after 4 hours.
  - FFmpeg output size capped at 2.5 GB.
- **Database Connection Pooling**:
  - Neon PostgreSQL connection pooler (`ep-empty-wave-ax7vmoho-pooler.c-4.us-east-2.aws.neon.tech`) prevents connection exhaustion.
