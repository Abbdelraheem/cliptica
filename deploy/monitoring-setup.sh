#!/usr/bin/env bash
# ============================================================
# NOLOGY Monitoring Setup
# ============================================================
# Sets up comprehensive monitoring with:
# - Prometheus node exporter
# - Custom application metrics
# - Health check endpoint monitoring
# - Log aggregation
# - Alerting rules
# ============================================================
set -euo pipefail

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

# Check root
if [[ $EUID -ne 0 ]]; then
    log_error "Run as root"
    exit 1
fi

log_info "Setting up NOLOGY monitoring..."

# ============================================================
# 1. Prometheus Node Exporter
# ============================================================
log_info "Installing Prometheus Node Exporter..."
{
    NODE_EXPORTER_VERSION="1.7.0"
    ARCH=$(uname -m)
    case "$(uname -m)" in
        aarch64|arm64) NODE_ARCH="arm64" ;;
        x86_64) NODE_ARCH="amd64" ;;
        *) log_error "Unsupported architecture"; exit 1 ;;
    esac
    
    cd /tmp
    curl -sL "https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-${NODE_ARCH}.tar.gz" | tar xz
    mv node_exporter-${NODE_EXPORTER_VERSION}.linux-${NODE_ARCH}/node_exporter /usr/local/bin/
    chmod +x /usr/local/bin/node_exporter
    
    # Create systemd service
    cat > /etc/systemd/system/node-exporter.service <<'EOF'
[Unit]
Description=Prometheus Node Exporter
After=network.target

[Service]
User=root
ExecStart=/usr/local/bin/node_exporter --collector.systemd --collector.processes --collector.filesystem.ignored-mount-points='^/(sys|proc|dev|run|var/lib/docker|var/lib/kubelet)($|/)'
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable node-exporter
    systemctl start node-exporter
} 2>&1 | tee -a /var/log/nology-monitoring.log
log_success "Node Exporter installed and started"

# ============================================================
# 2. Custom Application Metrics Exporter
# ============================================================
log_info "Creating custom metrics exporter..."
{
    cat > /opt/nology/scripts/metrics-exporter.py <<'PYEOF'
#!/usr/bin/env python3
"""
NOLOGY Custom Metrics Exporter
Exposes application-specific metrics for Prometheus scraping
"""
import os
import sys
import time
import psycopg2
import requests
from prometheus_client import start_http_server, Gauge, Counter, Histogram

# Metrics
JOBS_QUEUED = Gauge('nology_jobs_queued', 'Number of jobs in queue')
JOBS_PROCESSING = Gauge('nology_jobs_processing', 'Number of jobs currently processing')
JOBS_COMPLETED_TOTAL = Counter('nology_jobs_completed_total', 'Total completed jobs', ['status'])
JOB_DURATION = Histogram('nology_job_duration_seconds', 'Job processing duration', buckets=[10, 30, 60, 120, 300, 600, 1800, 3600])
CREDITS_BALANCE = Gauge('nology_user_credits', 'User credit balance', ['user_id', 'role'])
ACTIVE_USERS = Gauge('nology_active_users', 'Users with activity in last 24h')
API_REQUESTS = Counter('nology_api_requests_total', 'Total API requests', ['endpoint', 'method', 'status'])
API_LATENCY = Histogram('nology_api_latency_seconds', 'API request latency', ['endpoint'], buckets=[0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10])
WORKER_STATUS = Gauge('nology_worker_status', 'Worker status (1=online, 0=offline)')
DISK_USAGE = Gauge('nology_disk_usage_bytes', 'Disk usage', ['path'])
MEMORY_USAGE = Gauge('nology_memory_usage_bytes', 'Memory usage', ['type'])

def get_db_connection():
    """Get database connection"""
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        return None
    return psycopg2.connect(db_url)

def collect_job_metrics():
    """Collect job-related metrics"""
    conn = get_db_connection()
    if not conn:
        return
    
    try:
        with conn.cursor() as cur:
            # Jobs queued
            cur.execute("SELECT COUNT(*) FROM processing_jobs WHERE status = 'queued'")
            JOBS_QUEUED.set(cur.fetchone()[0])
            
            # Jobs processing
            cur.execute("SELECT COUNT(*) FROM processing_jobs WHERE status = 'processing'")
            JOBS_PROCESSING.set(cur.fetchone()[0])
            
            # Completed jobs (last hour)
            cur.execute("""
                SELECT status, COUNT(*) FROM processing_jobs 
                WHERE completed_at > NOW() - INTERVAL '1 hour' 
                GROUP BY status
            """)
            for status, count in cur.fetchall():
                JOBS_COMPLETED_TOTAL.labels(status=status).inc(count)
                
    except Exception as e:
        print(f"Error collecting job metrics: {e}", file=sys.stderr)
    finally:
        if conn:
            conn.close()

def collect_user_metrics():
    """Collect user-related metrics"""
    conn = get_db_connection()
    if not conn:
        return
    
    try:
        with conn.cursor() as cur:
            # Active users (last 24h)
            cur.execute("""
                SELECT COUNT(DISTINCT user_id) FROM credit_transactions 
                WHERE created_at > NOW() - INTERVAL '24 hours'
            """)
            ACTIVE_USERS.set(cur.fetchone()[0])
            
            # Credit balances by role
            cur.execute("""
                SELECT role, SUM(credits) FROM users 
                GROUP BY role
            """)
            for role, total in cur.fetchall():
                CREDITS_BALANCE.labels(user_id='total', role=role).set(total or 0)
                
    except Exception as e:
        print(f"Error collecting user metrics: {e}", file=sys.stderr)
    finally:
        if conn:
            conn.close()

def collect_system_metrics():
    """Collect system-level metrics"""
    try:
        # Disk usage
        import shutil
        total, used, free = shutil.disk_usage('/')
        DISK_USAGE.labels(path='/').set(used)
        DISK_USAGE.labels(path='/opt/nology').set(shutil.disk_usage('/opt/nology').used)
        
        # Memory
        import psutil
        mem = psutil.virtual_memory()
        MEMORY_USAGE.labels(type='total').set(mem.total)
        MEMORY_USAGE.labels(type='used').set(mem.used)
        MEMORY_USAGE.labels(type='available').set(mem.available)
        
        # Worker status
        try:
            resp = requests.get('http://localhost:3000/api/health', timeout=5)
            WORKER_STATUS.set(1 if resp.status_code == 200 else 0)
        except:
            WORKER_STATUS.set(0)
    except Exception as e:
        print(f"Error collecting system metrics: {e}", file=sys.stderr)

def main():
    # Start Prometheus metrics server
    start_http_server(9090)
    print("Metrics server started on port 9090")
    
    while True:
        try:
            collect_job_metrics()
            collect_user_metrics()
            collect_system_metrics()
        except Exception as e:
            print(f"Error in metrics collection: {e}", file=sys.stderr)
        
        time.sleep(30)

if __name__ == '__main__':
    main()
PYEOF

    chmod +x /opt/nology/scripts/metrics-exporter.py
    
    # Create systemd service
    cat > /etc/systemd/system/nology-metrics-exporter.service <<'EOF'
[Unit]
Description=NOLOGY Metrics Exporter
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/nology
Environment=PATH=/opt/nology-venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
EnvironmentFile=-/opt/nology/.env.production
ExecStart=/opt/nology-venv/bin/python /opt/nology/scripts/metrics-exporter.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Install python dependencies
    /opt/nology-venv/bin/pip install -q prometheus-client psutil psycopg2-binary requests
    
    systemctl daemon-reload
    systemctl enable nology-metrics-exporter
    systemctl start nology-metrics-exporter
} 2>&1 | tee -a /var/log/nology-monitoring.log
log_success "Custom metrics exporter created and started"

# ============================================================
# 3. Log aggregation with Loki (optional)
# ============================================================
log_info "Setting up log aggregation (optional)..."
{
    cat > /opt/nology/scripts/loki-config.yaml <<'EOF'
# Loki configuration for log aggregation
# Run with: docker run -d --name loki -p 3100:3100 -v /opt/nology/scripts/loki-config.yaml:/etc/loki/config.yaml grafana/loki:2.9.0
# Query with: grafana/grafana:10.2.0
EOF
} 2>&1 | tee -a /var/log/nology-monitoring.log
log_info "Loki config template created (run manually if needed)"

# ============================================================
# 4. Alerting Rules
# ============================================================
log_info "Creating alerting rules..."
{
    cat > /opt/nology/scripts/alert-rules.yml <<'EOF'
# Prometheus Alerting Rules for NOLOGY
groups:
- name: nology-alerts
  interval: 30s
  rules:
    # High priority alerts
    - alert: NologyWebDown
      expr: up{job="nology-web"} == 0
      for: 1m
      labels:
        severity: critical
      annotations:
          summary: "NOLOGY Web is down"
          description: "Web application has been down for more than 1 minute"

    - alert: NologyWorkerDown
      expr: up{job="nology-worker"} == 0
      for: 2m
      labels:
        severity: critical
      annotations:
          summary: "NOLOGY Worker is down"
          description: "Video processing worker has been down for more than 2 minutes"

    - alert: NologyHighJobQueue
      expr: nology_jobs_queued > 50
      for: 5m
      labels:
        severity: warning
      annotations:
          summary: "High job queue backlog"
          description: "More than 50 jobs queued for processing"

    - alert: NologyJobStuck
      expr: nology_jobs_processing > 0 and nology_jobs_queued == 0
      for: 30m
      labels:
        severity: warning
      annotations:
          summary: "Job potentially stuck"
          description: "Job has been processing for more than 30 minutes with no queue movement"

    - alert: NologyLowCredits
      expr: nology_user_credits{role="FREE"} < 10
      for: 5m
      labels:
        severity: warning
      annotations:
          summary: "User credits running low"
          description: "Free tier user has less than 10 credits remaining"

    - alert: NologyHighErrorRate
      expr: |
        rate(nology_api_requests_total{status=~"5.."}[5m]) / rate(nology_api_requests_total[5m]) > 0.05
      for: 2m
      labels:
        severity: critical
      annotations:
          summary: "High API error rate"
          description: "More than 5% of API requests returning 5xx errors"

    - alert: NologyHighLatency
      expr: |
        histogram_quantile(0.95, rate(nology_api_latency_seconds_bucket[5m])) > 5
      for: 5m
      labels:
        severity: warning
      annotations:
          summary: "High API latency"
          description: "95th percentile latency exceeds 5 seconds"

    - alert: NologyDiskSpaceLow
      expr: (nology_disk_usage_bytes{path="/"} / nology_disk_usage_bytes{path="/"} * 100) > 85
      for: 5m
      labels:
        severity: warning
      annotations:
          summary: "Disk space running low"
          description: "Root disk usage exceeds 85%"

    - alert: NologyHighMemoryUsage
      expr: (nology_memory_usage_bytes{type="used"} / nology_memory_usage_bytes{type="total"} * 100) > 90
      for: 5m
      labels:
        severity: warning
      annotations:
          summary: "High memory usage"
          description: "System memory usage exceeds 90%"

    - alert: NologyDatabaseConnectionFailed
      expr: |
        (rate(nology_api_requests_total{status=~"5..",endpoint=~".*database.*"}[5m]) > 0)
      for: 1m
      labels:
        severity: critical
      annotations:
          summary: "Database connection failures detected"
          description: "API requests involving database are failing"

    - alert: NologyStripeWebhookFailures
      expr: |
        rate(nology_api_requests_total{endpoint="/api/billing/webhook",status=~"5.."}[5m]) > 0
      for: 1m
      labels:
        severity: critical
      annotations:
          summary: "Stripe webhook failures"
          description: "Stripe webhook endpoint returning 5xx errors"
EOF
} 2>&1 | tee -a /var/log/nology-monitoring.log
log_success "Alerting rules created"

# ============================================================
# 5. Grafana Dashboard (JSON)
# ============================================================
log_info "Creating Grafana dashboard template..."
{
    cat > /opt/nology/scripts/grafana-dashboard.json <<'EOF'
{
  "dashboard": {
    "title": "NOLOGY Production Dashboard",
    "tags": ["nology", "production"],
    "timezone": "utc",
    "panels": [
      {
        "title": "Web App Status",
        "type": "stat",
        "targets": [{"expr": "up{job=\"nology-web\"}", "legendFormat": "Web App"}],
        "fieldConfig": {"defaults": {"mappings": [{"type": "value", "options": {"0": {"text": "DOWN", "color": "red"}, "1": {"text": "UP", "color": "green"}}}]}},
        "gridPos": {"x": 0, "y": 0, "w": 6, "h": 4}
      },
      {
        "title": "Worker Status",
        "type": "stat",
        "targets": [{"expr": "up{job=\"nology-worker\"}", "legendFormat": "Worker"}],
        "fieldConfig": {"defaults": {"mappings": [{"type": "value", "options": {"0": {"text": "DOWN", "color": "red"}, "1": {"text": "UP", "color": "green"}}}]}},
        "gridPos": {"x": 6, "y": 0, "w": 6, "h": 4}
      },
      {
        "title": "Jobs Queued",
        "type": "graph",
        "targets": [{"expr": "nology_jobs_queued", "legendFormat": "Queued"}],
        "gridPos": {"x": 12, "y": 0, "w": 12, "h": 8}
      },
      {
        "title": "Jobs Processing",
        "type": "graph",
        "targets": [{"expr": "nology_jobs_processing", "legendFormat": "Processing"}],
        "gridPos": {"x": 0, "y": 8, "w": 12, "h": 8}
      },
      {
        "title": "API Request Rate",
        "type": "graph",
        "targets": [{"expr": "rate(nology_api_requests_total[5m])", "legendFormat": "{{endpoint}}"}],
        "gridPos": {"x": 12, "y": 8, "w": 12, "h": 8}
      },
      {
        "title": "API Latency (p95)",
        "type": "graph",
        "targets": [{"expr": "histogram_quantile(0.95, rate(nology_api_latency_seconds_bucket[5m]))", "legendFormat": "p95"}],
        "gridPos": {"x": 0, "y": 16, "w": 12, "h": 8}
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [{"expr": "rate(nology_api_requests_total{status=~\"5..\"}[5m])", "legendFormat": "5xx"}],
        "gridPos": {"x": 12, "y": 16, "w": 12, "h": 8}
      },
      {
        "title": "Job Duration",
        "type": "graph",
        "targets": [{"expr": "histogram_quantile(0.5, rate(nology_job_duration_seconds_bucket[5m]))", "legendFormat": "median"}, {"expr": "histogram_quantile(0.95, rate(nology_job_duration_seconds_bucket[5m]))", "legendFormat": "p95"}],
        "gridPos": {"x": 0, "y": 24, "w": 12, "h": 8}
      },
      {
        "title": "Credits Balance by Role",
        "type": "table",
        "targets": [{"expr": "nology_user_credits", "format": "table"}],
        "gridPos": {"x": 12, "y": 24, "w": 12, "h": 8}
      },
      {
        "title": "Disk Usage",
        "type": "gauge",
        "targets": [{"expr": "nology_disk_usage_bytes{path=\"/\"} / (nology_disk_usage_bytes{path=\"/\"} + nology_disk_usage_bytes{path=\"/\"}) * 100", "legendFormat": "Root %"}],
        "fieldConfig": {"defaults": {"unit": "percent", "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": null}, {"color": "yellow", "value": 70}, {"color": "red", "value": 85}]}}},
        "gridPos": {"x": 0, "y": 32, "w": 6, "h": 6}
      },
      {
        "title": "Memory Usage",
        "type": "gauge",
        "targets": [{"expr": "nology_memory_usage_bytes{type=\"used\"} / nology_memory_usage_bytes{type=\"total\"} * 100", "legendFormat": "Memory %"}],
        "fieldConfig": {"defaults": {"unit": "percent", "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": null}, {"color": "yellow", "value": 70}, {"color": "red", "value": 85}]}}},
        "gridPos": {"x": 6, "y": 32, "w": 6, "h": 6}
      },
      {
        "title": "Active Users (24h)",
        "type": "stat",
        "targets": [{"expr": "nology_active_users", "legendFormat": "Active Users"}],
        "gridPos": {"x": 12, "y": 32, "w": 6, "h": 6}
      }
    ],
    "time": {"from": "now-1h", "to": "now"},
    "refresh": "30s"
  }
}
EOF
} 2>&1 | tee -a /var/log/nology-monitoring.log
log_success "Grafana dashboard template created"

log_success "=== Monitoring Setup Complete ==="
echo ""
echo "Components installed:"
echo "  - Prometheus Node Exporter (port 9100)"
echo "  - Custom Metrics Exporter (port 9090)"
echo "  - Alerting rules: /opt/nology/scripts/alert-rules.yml"
echo "  - Grafana dashboard: /opt/nology/scripts/grafana-dashboard.json"
echo ""
echo "To deploy Prometheus + Grafana:"
echo "  1. Install Prometheus: docker run -d -p 9090:9090 -v /opt/nology/scripts/prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus"
echo "  2. Install Grafana: docker run -d -p 3001:3000 -v /opt/nology/scripts/grafana-dashboard.json:/var/lib/grafana/dashboards/dashboard.json grafana/grafana"
echo "  3. Import alert rules into Prometheus"
echo "  3. Import dashboard into Grafana"