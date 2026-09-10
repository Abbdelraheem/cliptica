# Cliptica / Nology — Domain & Payment Gateway Launch Checklist

> **Purpose**: This step-by-step operational runbook guides the platform owner through binding a custom domain, generating free Let's Encrypt SSL certificates, and activating live Stripe subscriptions with zero code changes required.

---

## Architecture Overview

- **Production Server IP**: `13.62.192.145` (AWS EC2, Ubuntu 24.04 LTS)
- **App Directory**: `/opt/nology`
- **Environment File**: `/opt/nology/.env.production`
- **Nginx Configuration**: `/etc/nginx/sites-available/nology` (active in `/etc/nginx/sites-enabled/nology`)
- **PM2 App Services**: `nology-web` (Next.js frontend & API), `nology-worker` (Render pipeline), `nology-bot` (Telegram notifications)

---

## Part A: Domain & SSL Setup

Follow these steps once you purchase or configure your domain (e.g. `cliptica.com` or `app.cliptica.com`).

### Step 1: Point DNS to the Production Host
In your domain registrar DNS manager (Namecheap, Cloudflare, GoDaddy, Porkbun, etc.), add the following DNS records:

| Type | Name / Host | Value / Target | TTL | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `@` (or `cliptica.com`) | `13.62.192.145` | Auto / 300s | Points apex domain to EC2 |
| **A** | `www` | `13.62.192.145` | Auto / 300s | Points www subdomain to EC2 |

*(If using a subdomain like `app.cliptica.com`, set Type **A**, Name `app`, Value `13.62.192.145`)*

> [!NOTE]
> If you use Cloudflare DNS, set the proxy status to **DNS only** (Grey Cloud) during initial SSL certificate issuance so Let's Encrypt can verify the HTTP-01 challenge directly. You can re-enable Orange Cloud proxy afterwards if desired.

Verify DNS propagation from your local terminal:
```bash
nslookup yourdomain.com
# Must resolve to 13.62.192.145
```

---

### Step 2: Install Certbot on the EC2 Server
Connect to your EC2 server:
```bash
ssh -i /path/to/cliptica-key.pem ubuntu@13.62.192.145
```

Install Certbot and the Nginx plugin:
```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

---

### Step 3: Update Nginx `server_name`
Edit the active Nginx configuration file:
```bash
sudo nano /etc/nginx/sites-available/nology
```

Find the `server_name` line (around line 115):
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
```

Replace `server_name _;` with your actual domain(s):
```nginx
    server_name yourdomain.com www.yourdomain.com;
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`), then test the configuration syntax:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

### Step 4: Issue SSL Certificate via Let's Encrypt
Run Certbot:
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
- Enter your admin email when prompted for urgent renewal notices.
- Agree to the Terms of Service.
- Certbot will automatically verify ownership, install the HTTPS certificate, and configure HTTP-to-HTTPS 301 redirection.

Verify automated renewal is active:
```bash
sudo certbot renew --dry-run
```

---

### Step 5: Update Application Environment Variables
Update the base URLs in `/opt/nology/.env.production` to use your secure HTTPS domain:
```bash
sudo nano /opt/nology/.env.production
```

Modify the following keys:
```env
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
NEXTAUTH_URL="https://yourdomain.com"
```

Save the file, then restart the services to load the updated URLs:
```bash
cd /opt/nology
sudo pm2 reload nology-web --update-env
sudo pm2 reload nology-worker --update-env
sudo pm2 save
```

Your domain is now live, encrypted with SSL, and serving Cliptica.

---

## Part B: Stripe Payment Gateway Live Activation

Cliptica’s billing codebase is 100% agnostic to test vs. live mode. When you pass `sk_live_...` and `whsec_...`, Stripe SDK and webhook handlers switch to production processing automatically without changing any code.

---

### Step 1: Obtain Live API Keys from Stripe Dashboard
1. Log in to [Stripe Dashboard](https://dashboard.stripe.com).
2. Toggle the switch in the top header from **Test Mode** to **Live Mode**.
3. Navigate to **Developers** -> **API keys**:
   - Copy **Secret key** (`sk_live_...`)
   - Copy **Publishable key** (`pk_live_...`)

---

### Step 2: Create Live Products & Pricing in Stripe
In Stripe Dashboard (Live Mode):
1. Go to **Product catalog** -> **Add product**.
2. **Product 1 — Clipper Plan**:
   - Name: `Clipper`
   - Description: `300 credits/month, 1080p 60fps, No watermark`
   - Pricing Model: Flat rate
   - Price: `$19.00` USD
   - Billing period: **Monthly (recurring)**
   - Click **Save product**, then copy the Price ID (`price_...`).
3. **Product 2 — Studio Plan**:
   - Name: `Studio`
   - Description: `1,200 credits/month, Priority queue, Auto-Pilot watchlists`
   - Pricing Model: Flat rate
   - Price: `$49.00` USD
   - Billing period: **Monthly (recurring)**
   - Click **Save product**, then copy the Price ID (`price_...`).

---

### Step 3: Register Production Webhook in Stripe
1. In Stripe Dashboard (Live Mode), go to **Developers** -> **Webhooks**.
2. Click **Add destination** / **Add endpoint**.
3. **Endpoint URL**:
   ```
   https://yourdomain.com/api/billing/webhook
   ```
4. **Description**: `Cliptica Production Billing Webhook`
5. **Events to send** (Select exactly these 5 events):
   - `checkout.session.completed` (Fulfills initial subscription upgrade and credits)
   - `customer.subscription.created` (Synchronizes subscription metadata)
   - `customer.subscription.updated` (Handles tier upgrades/downgrades/status changes)
   - `customer.subscription.deleted` (Handles cancellations; resets role to FREE)
   - `invoice.payment_succeeded` (Grants monthly credit replenishments)
   - `invoice.payment_failed` (Records failed renewal in audit log)
6. Click **Add endpoint**.
7. In the endpoint details page, click **Reveal** under **Signing secret** and copy the secret (`whsec_...`).

---

### Step 4: Update `/opt/nology/.env.production` with Live Credentials
On the EC2 host:
```bash
sudo nano /opt/nology/.env.production
```

Replace the test Stripe variables with the live ones:
```env
# Stripe Live Configuration
STRIPE_SECRET_KEY="sk_live_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_CLIPPER_MONTHLY="price_..."
STRIPE_PRICE_STUDIO_MONTHLY="price_..."
```
*(Note: `STRIPE_CLIPPER_PRICE_ID` and `STRIPE_STUDIO_PRICE_ID` are also supported as aliases)*.

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

### Step 5: Reload Web & Worker Processes
Reload PM2 services to inject the updated live secrets:
```bash
cd /opt/nology
sudo pm2 reload nology-web --update-env
sudo pm2 reload nology-worker --update-env
sudo pm2 save
```

Verify service health:
```bash
curl -i https://yourdomain.com/api/health
# Expected: HTTP/2 200 OK {"status":"ok","stripe":"configured",...}
```

---

### Step 6: Verify Webhook Connectivity Without Real Charges
You can verify the webhook listener is reachable and responsive using the Stripe CLI or Stripe Dashboard:

**Method 1 — Via Stripe Dashboard (Easiest)**:
1. Go to **Developers** -> **Webhooks** -> click your endpoint (`https://yourdomain.com/api/billing/webhook`).
2. Click **Test in Stripe CLI** or **Send test event**.
3. Select `checkout.session.completed` or `customer.subscription.updated`.
4. Click **Send test event**.
5. Check the delivery log: Stripe should show `200 OK`.

**Method 2 — Via Server Terminal**:
Run a local diagnostic curl on the EC2 host:
```bash
curl -X POST https://yourdomain.com/api/billing/webhook \
  -H "Content-Type: application/json" \
  -d '{"id":"evt_test"}'
```
Expected response:
```json
{"error":"Webhook signature verification failed"}
```
*(HTTP 400 is expected because no valid `stripe-signature` was attached — confirming the endpoint is alive, actively protecting against spoofing, and validating cryptographic signatures).*

---

## Summary of Files & Paths Reference

| Component | Absolute Path on Host | Purpose |
| :--- | :--- | :--- |
| **Nginx Site Conf** | `/etc/nginx/sites-available/nology` | Reverse proxy, rate limiting, and SSL termination |
| **Production Env** | `/opt/nology/.env.production` | Environment variables, keys, database connection |
| **Certbot Webroot**| `/var/www/certbot` | ACME challenge path for certificate renewal |
| **Checkout Route** | `src/app/api/billing/checkout/route.ts` | Initiates hosted Stripe Checkout |
| **Portal Route**   | `src/app/api/billing/portal/route.ts` | Stripe Customer Portal for self-serve cancellation |
| **Webhook Route**  | `src/app/api/billing/webhook/route.ts` | Idempotent transaction processor for subscriptions |
| **Stripe Lib**     | `src/lib/stripe.ts` | Stripe client initialization and plan definitions |
