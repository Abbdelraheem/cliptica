#!/usr/bin/env bash
# ============================================================
# NOLOGY Certbot SSL Setup Script
# ============================================================
# Automates Let's Encrypt SSL certificate provisioning via Certbot
# 
# Usage:
#   sudo bash deploy/certbot-setup.sh app.yourdomain.com
# 
# Requirements:
#   - Nginx configured and running
#   - Domain DNS pointing to this server
#   - Port 80 accessible for ACME challenge
# ============================================================
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check root
if [[ $EUID -ne 0 ]]; then
    log_error "Run as root: sudo bash $0 <domain>"
    exit 1
fi

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
    log_error "Usage: $0 <domain>"
    log_info "Example: sudo bash $0 app.getnology.com"
    exit 1
fi

EMAIL="${2:-admin@$DOMAIN}"

log_info "Setting up SSL for $DOMAIN"

# Check if nginx is running
if ! systemctl is-active --quiet nginx; then
    log_error "Nginx is not running. Start it first: systemctl start nginx"
    exit 1
fi

# Check if domain resolves to this server
SERVER_IP=$(curl -s ifconfig.me || curl -s icanhazip.com)
DOMAIN_IP=$(dig +short "$DOMAIN" | head -1)

if [[ "$DOMAIN_IP" != "$SERVER_IP" ]]; then
    log_warn "Domain $DOMAIN resolves to $DOMAIN_IP but server IP is $SERVER_IP"
    log_warn "Certbot may fail if DNS doesn't point to this server"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create webroot for ACME challenge
mkdir -p /var/www/certbot

# Check if Nginx config exists for this domain
NGINX_SITE="/etc/nginx/sites-enabled/nology"
if [[ ! -f "$NGINX_SITE" ]]; then
    log_error "Nginx site not found at $NGINX_SITE"
    log_info "Run the deploy script first to generate Nginx config"
    exit 1
fi

# Check if domain placeholder is replaced in nginx config
if grep -q "__DOMAIN__" /etc/nginx/sites-enabled/nology; then
    log_error "Nginx config still has __DOMAIN__ placeholder"
    log_info "Run deploy script to populate domain in Nginx config"
    exit 1
fi

# Obtain certificate
log_info "Requesting Let's Encrypt certificate for $DOMAIN..."
certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    --non-interactive \
    -d "$DOMAIN"

if [[ $? -ne 0 ]]; then
    log_error "Certbot failed to obtain certificate"
    log_info "Check: DNS points to this server, port 80 accessible, Nginx running"
    exit 1
fi

log_success "Certificate obtained for $DOMAIN"

# Verify certificate files
CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/$DOMAIN/privkey.pem"

if [[ ! -f "$CERT_PATH" ]] || [[ ! -f "$KEY_PATH" ]]; then
    log_error "Certificate files not found at expected paths"
    exit 1
fi

log_success "Certificate files verified"

# Update Nginx config with actual domain (if still using placeholder)
if grep -q "__DOMAIN__" /etc/nginx/sites-enabled/nology; then
    sed -i "s/__DOMAIN__/$DOMAIN/g" /etc/nginx/sites-enabled/nology
    log_info "Updated Nginx config with domain: $DOMAIN"
fi

# Test Nginx config
log_info "Testing Nginx configuration..."
if nginx -t; then
    log_success "Nginx configuration test passed"
    systemctl reload nginx
    log_success "Nginx reloaded"
else
    log_error "Nginx configuration test failed"
    exit 1
fi

# Setup auto-renewal
log_info "Setting up automatic certificate renewal..."
CRON_JOB="0 3 * * * certbot renew --quiet --nginx --post-hook 'systemctl reload nginx' >> /var/log/certbot-renewal.log 2>&1"
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_JOB") | crontab -
log_success "Auto-renewal cron job installed"

# Test renewal (dry run)
log_info "Testing certificate renewal (dry run)..."
if certbot renew --dry-run --quiet; then
    log_success "Renewal test passed"
else
    log_warn "Renewal test failed - check certbot configuration"
fi

# Verify HTTPS
log_info "Verifying HTTPS access..."
sleep 2
if curl -sf "https://$DOMAIN/api/health" >/dev/null; then
    log_success "HTTPS health check passed"
else
    log_warn "HTTPS health check failed - may need a moment for DNS propagation"
fi

log_success "=== SSL Setup Complete for $DOMAIN ==="
echo ""
echo "Certificate location: $CERT_PATH"
echo "Key location: $KEY_PATH"
echo "Auto-renewal: Configured via cron (daily at 3 AM)"
echo ""
echo "To manually renew: certbot renew"
echo "To test renewal: certbot renew --dry-run"