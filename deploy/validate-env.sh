#!/usr/bin/env bash
# ============================================================
# NOLOGY Environment Validation Script
# ============================================================
# Validates all required environment variables for production
# Usage: bash deploy/validate-env.sh [--strict]
# Exit codes:
#   0 - All required variables present and valid
#   1 - Missing required variables
#   2 - Invalid format (strict mode)
# ============================================================
set -euo pipefail

STRICT_MODE=false
if [[ "${1:-}" == "--strict" ]]; then
    STRICT_MODE=true
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Load environment
ENV_FILE="${ENV_FILE:-/opt/nology/.env.production}"
if [[ ! -f "$ENV_FILE" ]]; then
    log_error "Environment file not found: $ENV_FILE"
    exit 1
fi

# Load env file (export all vars)
set -a
source "$ENV_FILE"
set +a

# Required variables (must be set and non-empty)
REQUIRED_VARS=(
    # Database
    "DATABASE_URL"
    
    # Auth
    "NEXTAUTH_URL"
    "NEXTAUTH_SECRET"
    
    # OAuth (optional but recommended)
    # "GOOGLE_CLIENT_ID"
    # "GOOGLE_CLIENT_SECRET"
    # "GITHUB_CLIENT_ID"
    # "GITHUB_CLIENT_SECRET"
    
    # Cloudflare R2
    "R2_ENDPOINT"
    "R2_BUCKET"
    "R2_ACCESS_KEY_ID"
    "R2_SECRET_ACCESS_KEY"
    
    # AI Services
    "GROQ_API_KEY"
    # "OPENAI_API_KEY"  # Optional fallback
    
    # Stripe
    "STRIPE_SECRET_KEY"
    "STRIPE_WEBHOOK_SECRET"
    "STRIPE_PRICE_CLIPPER_MONTHLY"
    "STRIPE_PRICE_STUDIO_MONTHLY"
    
    # App
    "NEXT_PUBLIC_APP_URL"
    
    # Pipeline tuning
    "MIN_CREDITS_REQUIRED"
    "MAX_UPLOAD_MB"
    "RENDER_PARALLEL"
    "CLIPS_PER_VIDEO"
    "CLIP_TARGET_SECONDS"
    
    # Error tracking (optional)
    # "NEXT_PUBLIC_SENTRY_DSN"
    # "SENTRY_DSN"
    
    # Rate limiting (optional)
    # "UPSTASH_REDIS_REST_URL"
    # "UPSTASH_REDIS_REST_TOKEN"
    
    # Email (optional)
    # "RESEND_API_KEY"
    # "EMAIL_FROM"
    
    # Pipeline tuning
    "WHISPER_MODEL"
    "CLIPS_PER_VIDEO"
    "CLIP_TARGET_SECONDS"
    "RENDER_PARALLEL"
)

# Optional variables (warn if missing but don't fail)
OPTIONAL_VARS=(
    "GOOGLE_CLIENT_ID"
    "GOOGLE_CLIENT_SECRET"
    "GITHUB_CLIENT_ID"
    "GITHUB_CLIENT_SECRET"
    "OPENAI_API_KEY"
    "NEXT_PUBLIC_SENTRY_DSN"
    "SENTRY_DSN"
    "UPSTASH_REDIS_REST_URL"
    "UPSTASH_REDIS_REST_TOKEN"
    "RESEND_API_KEY"
    "EMAIL_FROM"
    "MOTION_FONT"
    "PIPELINE_PREMIUM"
    "STATIC_EXPORT"
    "STALE_JOB_MINUTES"
    "MOTION_FONT"
    "CLIP_TARGET_SECONDS"
    "WHISPER_MODEL"
)

# Validation functions
validate_url() {
    local var_name="$1"
    local value="${!var_name}"
    if [[ -n "$value" ]] && ! [[ "$value" =~ ^https?:// ]]; then
        log_error "$var_name: must be a valid URL (http:// or https://)"
        return 1
    fi
    return 0
}

validate_email() {
    local var_name="$1"
    local value="${!var_name}"
    if [[ -n "$value" ]] && ! [[ "$value" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        log_warn "$var_name: doesn't look like a valid email address"
    fi
    return 0
}

validate_positive_int() {
    local var_name="$1"
    local value="${!var_name}"
    if [[ -n "$value" ]] && ! [[ "$value" =~ ^[0-9]+$ ]]; then
        log_error "$var_name: must be a positive integer"
        return 1
    fi
    if [[ -n "$value" && "$value" -le 0 ]]; then
        log_error "$var_name: must be greater than 0"
        return 1
    fi
    return 0
}

validate_database_url() {
    local value="${DATABASE_URL:-}"
    if [[ -z "$value" ]]; then
        return 1
    fi
    if ! [[ "$value" =~ ^postgresql:// ]]; then
        log_error "DATABASE_URL must be a PostgreSQL connection string (postgresql://...)"
        return 1
    fi
    # Check for pooler (recommended for production)
    if [[ "$value" == *"pooler"* ]]; then
        log_info "Using PostgreSQL pooler - good for production"
    else
        log_warn "Consider using a connection pooler for production DATABASE_URL"
    fi
    return 0
}

validate_r2_endpoint() {
    local value="${R2_ENDPOINT:-}"
    if [[ -z "$value" ]]; then
        return 1
    fi
    if ! [[ "$value" =~ ^https://.*\.r2\.cloudflarestorage\.com$ ]]; then
        log_error "R2_ENDPOINT must be a Cloudflare R2 endpoint (https://<accountid>.r2.cloudflarestorage.com)"
        return 1
    fi
    return 0
}

# Validation runner
run_validation() {
    local errors=0
    local warnings=0
    
    log_info "Validating environment variables from $ENV_FILE"
    echo ""
    
    # Check required variables
    for var in "${REQUIRED_VARS[@]}"; do
        local value="${!var:-}"
        if [[ -z "$value" ]] || [[ "$value" == *"CHANGE"* ]] || [[ "$value" == *"placeholder"* ]] || [[ "$value" == *"your-"* ]] || [[ "$value" == *"your_"* ]]; then
            log_error "Required variable missing or placeholder: $var"
            ((errors++))
        else
            log_success "$var is set"
        fi
    done
    
    # Run specific validations
    validate_database_url || ((errors++))
    validate_r2_endpoint || ((errors++))
    validate_url "NEXTAUTH_URL" || ((errors++))
    validate_url "NEXT_PUBLIC_APP_URL" || ((errors++))
    validate_url "R2_ENDPOINT" || ((errors++))
    
    validate_email "EMAIL_FROM"
    
    # Check positive integers
    for var in MIN_CREDITS_REQUIRED MAX_UPLOAD_MB RENDER_PARALLEL CLIPS_PER_VIDEO CLIP_TARGET_SECONDS STALE_JOB_MINUTES; do
        validate_positive_int "$var" || ((errors++))
    done
    
    # Check Stripe price IDs format
    if [[ -n "${STRIPE_PRICE_CLIPPER_MONTHLY:-}" ]] && ! [[ "$STRIPE_PRICE_CLIPPER_MONTHLY" =~ ^price_[a-zA-Z0-9]+$ ]]; then
        log_warn "STRIPE_PRICE_CLIPPER_MONTHLY doesn't look like a valid Stripe price ID (should start with price_)"
        ((warnings++))
    fi
    
    if [[ -n "${STRIPE_PRICE_STUDIO_MONTHLY:-}" ]] && ! [[ "$STRIPE_PRICE_STUDIO_MONTHLY" =~ ^price_[a-zA-Z0-9]+$ ]]; then
        log_warn "STRIPE_PRICE_STUDIO_MONTHLY doesn't look like a valid Stripe price ID (should start with price_)"
        ((warnings++))
    fi
    
    # Check Stripe webhook secret format
    if [[ -n "${STRIPE_WEBHOOK_SECRET:-}" ]] && ! [[ "$STRIPE_WEBHOOK_SECRET" =~ ^whsec_[a-zA-Z0-9]+$ ]]; then
        log_warn "STRIPE_WEBHOOK_SECRET doesn't look like a valid webhook secret (should start with whsec_)"
        ((warnings++))
    fi
    
    # Check Stripe secret key format
    if [[ -n "${STRIPE_SECRET_KEY:-}" ]] && ! [[ "$STRIPE_SECRET_KEY" =~ ^sk_(test|live)_[a-zA-Z0-9]+$ ]]; then
        log_warn "STRIPE_SECRET_KEY doesn't look like a valid Stripe secret key (should start with sk_test_ or sk_live_)"
        ((warnings++))
    fi
    
    # Check optional variables
    for var in "${OPTIONAL_VARS[@]}"; do
        local value="${!var:-}"
        if [[ -z "$value" ]] || [[ "$value" == *"placeholder"* ]] || [[ "$value" == *"CHANGE"* ]]; then
            log_warn "Optional variable not set: $var"
            ((warnings++))
        fi
    done
    
    # Check for common placeholder patterns
    for var in "${!REQUIRED_VARS[@]}" "${!OPTIONAL_VARS[@]}"; do
        local value="${!var:-}"
        if [[ "$value" == *"CHANGE_ME"* ]] || [[ "$value" == *"REPLACE_ME"* ]] || [[ "$value" == *"your-"* ]] || [[ "$value" == *"your_"* ]] || [[ "$value" == *"xxx"* ]]; then
            log_error "$var contains placeholder value"
            ((errors++))
        fi
    done
    
    echo ""
    echo "=========================================="
    if [[ $errors -gt 0 ]]; then
        log_error "Validation FAILED: $errors error(s), $warnings warning(s)"
        return 1
    elif [[ $warnings -gt 0 ]]; then
        log_warn "Validation PASSED with $warnings warning(s)"
        return 0
    else
        log_success "All validations passed - environment is production-ready!"
        return 0
    fi
}

# Main
log_info "Validating environment: $ENV_FILE"
run_validation
exit $?