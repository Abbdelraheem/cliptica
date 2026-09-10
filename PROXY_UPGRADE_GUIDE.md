# Upgrading to a Paid Residential / Rotating Proxy for Cliptica

> Step-by-step guide for connecting a paid proxy service to Cliptica's video worker to achieve 99.9% YouTube download reliability.

---

## 1. Why a Paid Residential Proxy is Recommended

YouTube enforces automated bot-detection and rate-limiting against cloud hosting IPs (including AWS EC2, DigitalOcean, and GCP). 
While Cliptica includes an automated free proxy rotation engine with health scoring and failure quarantine, free proxies are inherently volatile:
- They frequently drop connections or go offline without notice.
- They have high latency (varying between 2s and 15s).

Connecting a paid residential rotating proxy service completely eliminates YouTube download blocks and provides high-speed, reliable video downloads.

---

## 2. Recommended Proxy Providers

Any standard HTTP/HTTPS proxy provider works out of the box. Highly tested options:

| Provider | Recommended Tier | Approx Cost | Website |
|---|---|---|---|
| **Webshare** | Static Residential or Rotating Residential | ~$6–$15 / mo | [webshare.io](https://www.webshare.io) |
| **Smartproxy** | Residential Proxies (Pay As You Go) | ~$7 / GB | [smartproxy.com](https://smartproxy.com) |
| **Bright Data** | Residential Proxy Network | Pay-as-you-go | [brightdata.com](https://brightdata.com) |
| **IPRoyal** | Royal Residential Proxies | ~$7 / GB | [iproyal.com](https://iproyal.com) |

---

## 3. Configuration Steps (Takes 2 Minutes)

Once you purchase proxy credentials (format: `http://username:password@proxy-host:port`):

### Step 1: Open the Server Environment File
Connect to the server via SSH:
```bash
ssh -i cliptica-key.pem ubuntu@13.62.192.145
sudo nano /opt/nology/.env.production
```

### Step 2: Add or Update `YTDLP_PROXIES`
Add your proxy URL to the `YTDLP_PROXIES` variable. 

```env
# Single rotating gateway (most providers provide a single rotating endpoint):
YTDLP_PROXIES="http://user12345:pass67890@p.webshare.io:80"

# Or multiple distinct proxies (comma-separated):
YTDLP_PROXIES="http://user:pass@gate1.example.com:8000,http://user:pass@gate2.example.com:8000"
```

### Step 3: Restart the Worker Process
Apply the new configuration immediately without restarting the web app:
```bash
sudo pm2 reload nology-worker --update-env
```

### Step 4: Verify in Worker Logs
Inspect the worker logs to confirm the proxy was loaded:
```bash
sudo pm2 logs nology-worker --lines 20
```
You will see:
```
[worker] online — premium=true, parallel=4, env=db+r2+cookies+groq-
[proxy-pool] candidate_count=1 starting rotation ...
[proxy-pool] downloaded via proxy=http://user:pass@...
```

---

## 4. How the Code Picks Up the Proxy

- **Worker Implementation**: In `worker/worker.mjs`, the `ytProxyPool()` function reads `process.env.YTDLP_PROXIES`.
- **Priority**: Proxies listed in `YTDLP_PROXIES` automatically receive **top priority** above any candidate proxies in the local fallback pool (`/opt/nology/proxies.txt`).
- **Graceful Fallback**: If the paid proxy ever runs out of bandwidth or fails, the worker automatically rotates through the fallback pool so jobs are not lost.
