#!/usr/bin/env python3
"""
NOLOGY Custom Metrics Exporter
Exposes application-specific metrics for Prometheus scraping
"""
import os
import sys
import time
import json

try:
    import psycopg2
    import requests
    from prometheus_client import start_http_server, Gauge, Counter, Histogram
except ImportError as e:
    print(f"Missing dependencies: {e}", file=sys.stderr)
    print("Install with: /opt/nology-venv/bin/pip install prometheus-client psutil psycopg2-binary requests", file=sys.stderr)
    sys.exit(1)

# ============================================================
# Prometheus Metrics Definitions
# ============================================================

# Job metrics
JOBS_QUEUED = Gauge('nology_jobs_queued', 'Number of jobs in queue')
JOBS_PROCESSING = Gauge('nology_jobs_processing', 'Number of jobs currently processing')
JOBS_COMPLETED_TOTAL = Counter('nology_jobs_completed_total', 'Total completed jobs', ['status'])
JOB_DURATION = Histogram('nology_job_duration_seconds', 'Job processing duration', 
                         buckets=[10, 30, 60, 120, 300, 600, 1800, 3600])

# User/Credit metrics
CREDITS_BALANCE = Gauge('nology_user_credits', 'User credit balance', ['user_id', 'role'])
ACTIVE_USERS = Gauge('nology_active_users', 'Users with activity in last 24h')

# API metrics
API_REQUESTS = Counter('nology_api_requests_total', 'Total API requests', ['endpoint', 'method', 'status'])
API_LATENCY = Histogram('nology_api_latency_seconds', 'API request latency', ['endpoint'], 
                       buckets=[0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10])

# Worker status
WORKER_STATUS = Gauge('nology_worker_status', 'Worker status (1=online, 0=offline)')

# System metrics
DISK_USAGE = Gauge('nology_disk_usage_bytes', 'Disk usage', ['path'])
MEMORY_USAGE = Gauge('nology_memory_usage_bytes', 'Memory usage', ['type'])

# ============================================================
# Database Connection
# ============================================================
def get_db_connection():
    """Get database connection from DATABASE_URL"""
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        return None
    try:
        return psycopg2.connect(db_url)
    except Exception as e:
        print(f"Database connection error: {e}", file=sys.stderr)
        return None

# ============================================================
# Metric Collection Functions
# ============================================================

def collect_job_metrics():
    """Collect job-related metrics from database"""
    conn = get_db_connection()
    if not conn:
        return
    
    try:
        with conn.cursor() as cur:
            # Jobs queued
            cur.execute("SELECT COUNT(*) FROM processing_jobs WHERE status = 'queued'")
            count = cur.fetchone()[0] if cur.rowcount > 0 else 0
            JOBS_QUEUED.set(count)
            
            # Jobs processing
            cur.execute("SELECT COUNT(*) FROM processing_jobs WHERE status = 'processing'")
            count = cur.fetchone()[0] if cur.rowcount > 0 else 0
            JOBS_PROCESSING.set(count)
            
            # Completed jobs (last hour) by status
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
            ACTIVE_USERS.set(cur.fetchone()[0] if cur.rowcount > 0 else 0)
            
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
        try:
            DISK_USAGE.labels(path='/opt/nology').set(shutil.disk_usage('/opt/nology').used)
        except:
            pass
        
        # Memory
        import psutil
        mem = psutil.virtual_memory()
        MEMORY_USAGE.labels(type='total').set(mem.total)
        MEMORY_USAGE.labels(type='used').set(mem.used)
        MEMORY_USAGE.labels(type='available').set(mem.available)
        
        # Worker status - check health endpoint
        try:
            resp = requests.get('http://localhost:3000/api/health', timeout=5)
            WORKER_STATUS.set(1 if resp.status_code == 200 else 0)
        except:
            WORKER_STATUS.set(0)
    except Exception as e:
        print(f"Error collecting system metrics: {e}", file=sys.stderr)

# ============================================================
# Main Loop
# ============================================================

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