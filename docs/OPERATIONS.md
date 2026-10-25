# Clipzila — Production Operations Runbook

This runbook provides step-by-step operating procedures for system administrators managing the Clipzila production environment.

---

## 1. Rotating a Production Secret

### Step-by-Step Procedure

1. **Generate New Credentials**:
   - NextAuth / Encryption Secret:
     ```bash
     openssl rand -base64 32
     ```
   - API Provider Keys: Generate a replacement key in the respective dashboard (Groq, NVIDIA, Stripe, Paddle, Cloudflare R2, Resend).

2. **Update Server Environment File**:
   - Connect to the production server:
     ```bash
     ssh ubuntu@<SERVER_IP>
     sudo nano /opt/nology/.env
     ```
   - Replace the outdated secret value. Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

3. **Reload Running Processes (Zero Downtime)**:
   - For web server updates:
     ```bash
     pm2 reload nology-web
     ```
   - For worker updates:
     ```bash
     pm2 restart nology-worker
     ```

4. **Verify Application Health**:
   ```bash
   curl -i http://localhost:3000/api/health
   # Expected response: HTTP 200 {"status":"ok","timestamp":"..."}
   ```

5. **Revoke Old Secret**:
   - In the third-party provider dashboard, delete or disable the prior key after verifying the new key processes traffic.

---

## 2. Granting Admin Permissions to a User

Clipzila includes an automated script for promoting users to the `ADMIN` role.

### Runbook Command
```bash
# On the production server:
cd /opt/nology
node scripts/set-admin.mjs <USER_EMAIL>
```

### Verification
```sql
-- Connect via psql or Neon SQL Console:
SELECT id, email, role, credits FROM "User" WHERE email = '<USER_EMAIL>';
-- Expected: role = 'ADMIN'
```
*Note: Users with the `ADMIN` role bypass credit balance checks, bypass device limit locks, and gain access to `/admin` diagnostic endpoints.*

---

## 3. Handling a Stuck Worker Job

If a video processing job hangs due to an external network timeout or unexpected media format:

### 1. Identify Stuck Jobs
```sql
SELECT id, "projectId", status, progress, "createdAt", "updatedAt"
FROM "ProcessingJob"
WHERE status = 'PROCESSING' AND "updatedAt" < NOW() - INTERVAL '30 minutes';
```

### 2. Reset or Fail the Job Atomically
To retry the job:
```sql
UPDATE "ProcessingJob"
SET status = 'QUEUED', progress = 0, "updatedAt" = NOW()
WHERE id = '<JOB_ID>';
```
To fail the job and refund reserved credits:
```sql
UPDATE "ProcessingJob"
SET status = 'FAILED', error = 'Manually terminated by administrator', "updatedAt" = NOW()
WHERE id = '<JOB_ID>';
```

### 3. Check Worker Logs
```bash
pm2 logs nology-worker --lines 100
```
If the worker process is unresponsive, restart it:
```bash
pm2 restart nology-worker
```

---

## 4. Issuing a Refund

Because **Paddle.com** acts as the Merchant of Record (MoR) for Clipzila, payment refunds are processed directly through the Paddle transaction ledger.

### Procedure
1. **Locate Customer in Database**:
   ```sql
   SELECT id, email, "paddleCustomerId", "paddleSubscriptionId", role, credits
   FROM "User" WHERE email = '<USER_EMAIL>';
   ```
2. **Open Paddle Dashboard**:
   - Navigate to **Transactions** in [Paddle Seller Dashboard](https://vendors.paddle.com).
   - Search for the customer's email or `paddleCustomerId`.
   - Select the target transaction and click **Issue Refund**. Choose full or partial refund.
3. **Database Webhook Synchronization**:
   - When Paddle executes the refund, it emits a `transaction.refunded` or `subscription.canceled` webhook.
   - The handler (`/api/billing/paddle-webhook`) automatically downgrades the user role or deducts unearned credits.
   - To manually reset role if required:
     ```sql
     UPDATE "User" SET role = 'FREE', "subscriptionStatus" = 'canceled' WHERE email = '<USER_EMAIL>';
     ```

---

## 5. Rolling Back a Deployment

If an application regression is identified following a deployment:

### Fast Rollback via Git & PM2
```bash
cd /opt/nology

# 1. Inspect recent commits:
git log --oneline -n 5

# 2. Revert HEAD to known good commit hash:
git checkout <PREVIOUS_STABLE_COMMIT_HASH>

# 3. Rebuild Next.js standalone artifacts:
npm install
npx prisma generate
npm run build

# 4. Restart web and worker instances:
pm2 restart nology-web
pm2 restart nology-worker

# 5. Verify system health:
curl -i http://localhost:3000/api/health
```

---

## 6. Configuring YouTube Residential Proxies

To prevent YouTube bot-detection blocks on cloud server IP ranges:

### 1. Supported Format
In the production `.env`:
```env
# Single rotating proxy gateway:
YTDLP_PROXIES="http://user:password@proxy.example.com:8080"

# Or comma-separated list of proxies:
YTDLP_PROXIES="http://user:pass@proxy1.example.com:8080,http://user:pass@proxy2.example.com:8080"
```

### 2. Auto-Quarantine & Health Scoring
The worker (`worker/proxy-pool.mjs`) tracks success/failure rates in memory. Proxies that encounter 2 consecutive errors are automatically quarantined for 15 minutes, prioritizing healthy proxies.
