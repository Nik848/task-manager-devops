# Phase 7: Monitoring with Prometheus and Grafana

This directory provides complete, production-grade observability and metrics monitoring for the **Task Management System** deployed on Kubernetes using **Prometheus**, **Grafana**, and **Kubernetes Metrics Server / cAdvisor**.

---

## 1. Monitoring Architecture

```text
                                       Kubernetes Cluster (docker-desktop)
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                             │
│  [Namespace: task-manager]                                      [Namespace: kube-system]                    │
│  ┌─────────────────────────┐   ┌──────────────────────────┐    ┌────────────────────────────────────────┐   │
│  │ backend-deployment      │   │ frontend-deployment      │    │ metrics-server                         │   │
│  │ - Express + prom-client │   │ - React 18 + Vite (Nginx)│    │ - Resource Metrics API                 │   │
│  │ - :3000/metrics         │   │                          │    │ - kubectl top nodes / pods             │   │
│  └───────────┬─────────────┘   └──────────────────────────┘    └──────────────────┬─────────────────────┘   │
│              │ (http_requests_total, process_cpu, memory)                         │                         │
│              │                                                                    │                         │
│              ▼                                                                    ▼                         │
│  [Namespace: monitoring]                                                      kubelet                       │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │ Prometheus (v2.51.0, non-root UID 65534)                                                             │   │
│  │ • Scrape Job: task-manager-backend (backend-service.task-manager.svc.cluster.local:3000/metrics)       │   │
│  │ • Scrape Job: kubernetes-cadvisor (/api/v1/nodes/proxy/metrics/cadvisor via ServiceAccount token)    │   │
│  │ • Scrape Job: prometheus (localhost:9090 self-monitoring)                                            │   │
│  └──────────────────────────────────────────────────┬───────────────────────────────────────────────────┘   │
│                                                     │                                                       │
│                                                     ▼ (PromQL queries)                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │ Grafana (v10.4.0, non-root UID 472)                                                                  │   │
│  │ • Automated Datasource: http://prometheus-service.monitoring.svc.cluster.local:9090                  │   │
│  │ • Automated Dashboard: Task Management System — Operations Overview (UID: task-manager-overview)     │   │
│  └──────────────────────────────────────────────────┬───────────────────────────────────────────────────┘   │
│                                                     │                                                       │
└─────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┘
                                                      │ (kubectl port-forward)
                                                      ▼
                                       Host Machine (Windows 11)
                                       • Grafana:    http://localhost:3001
                                       • Prometheus: http://localhost:9090
```

---

## 2. Directory Structure

```text
monitoring/
├── README.md                          # Full operations and architecture manual
├── namespace.yaml                     # Dedicated 'monitoring' namespace definition
├── metrics-server.yaml                # Kubernetes Metrics Server manifest with --kubelet-insecure-tls
├── deploy.ps1                         # One-click deployment script for Windows/PowerShell
├── dashboards/
│   └── dashboard-task-manager.json    # Standalone Grafana Dashboard JSON definition
├── prometheus/
│   ├── rbac.yaml                      # ServiceAccount, ClusterRole, and ClusterRoleBinding
│   ├── configmap.yaml                 # Scrape configuration for backend, cAdvisor, and Prometheus
│   ├── deployment.yaml                # Prometheus deployment (non-root UID 65534, resource limits)
│   └── service.yaml                   # ClusterIP service on port 9090 (internal only)
└── grafana/
    ├── secret.yaml                    # Admin credentials (admin / devops-monitoring-admin)
    ├── configmap-datasources.yaml     # Auto-provisioned Prometheus datasource definition
    ├── configmap-dashboards.yaml      # Dashboard provider configuration
    ├── configmap-dashboard-json.yaml  # ConfigMap wrapping the dashboard JSON for auto-mounting
    ├── deployment.yaml                # Grafana deployment (non-root UID 472, resource limits)
    └── service.yaml                   # ClusterIP service on port 3000 (internal only)
```

---

## 3. Metrics Collection & PromQL Reference

The setup collects metrics across three distinct layers without duplicate instrumentation:

### A. Application Metrics (Exposed via `prom-client` in `backend`)
- **`http_requests_total`**: Counter of HTTP requests labeled by `method`, `route`, and `status_code`.
- **`http_request_duration_seconds`**: Histogram tracking execution latency across configurable buckets (`[0.01, 0.05, 0.1, 0.5, 1, 5]`).

### B. Node.js Process Runtime Metrics (Default `prom-client` collection)
- **`process_cpu_seconds_total`**: Total user and system CPU time consumed by the Node.js event loop.
- **`process_resident_memory_bytes`**: Physical memory (RSS) consumed by the process.
- **`nodejs_heap_size_used_bytes` / `nodejs_heap_size_total_bytes`**: V8 garbage collector heap utilization.
- **`nodejs_eventloop_lag_seconds`**: Event loop latency and responsiveness.

### C. Container & Node Resource Metrics (Kubelet cAdvisor & Metrics Server)
- **`container_cpu_usage_seconds_total`**: Real container CPU consumption collected by cAdvisor.
- **`container_memory_working_set_bytes`**: Real working set memory of running containers (avoids OOM kills).
- **Metrics Server API (`metrics.k8s.io/v1beta1`)**: Powers `kubectl top nodes` and `kubectl top pods`.

---

## 4. Grafana Dashboard Panels (`task-manager-overview`)

The provisioned dashboard includes 7 comprehensive operational panels:

| Panel # | Panel Name | Type | PromQL Query | Unit |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Backend Pod Availability (Health)** | Stat | `up{job="task-manager-backend"}` | Boolean (UP/DOWN) |
| **2** | **Backend HTTP Request Rate** | Time Series | `sum(rate(http_requests_total{job="task-manager-backend"}[1m])) by (method, route, status_code)` | `reqps` |
| **3** | **HTTP Request Latency (Avg & p95)** | Time Series | Avg: `sum(rate(http_request_duration_seconds_sum[1m])) / sum(rate(http_request_duration_seconds_count[1m]))`<br>p95: `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[1m])) by (le))` | seconds (`s`) |
| **4** | **Backend Process CPU Usage** | Time Series | `rate(process_cpu_seconds_total{job="task-manager-backend"}[1m]) * 100` | percent (`%`) |
| **5** | **Backend Process Memory Usage** | Time Series | RSS: `process_resident_memory_bytes`<br>Heap: `nodejs_heap_size_used_bytes`<br>Total: `nodejs_heap_size_total_bytes` | bytes |
| **6** | **Pod CPU Usage (cAdvisor)** | Time Series | `sum(rate(container_cpu_usage_seconds_total{namespace="task-manager", container=~"backend\|frontend"}[1m])) by (pod, container) * 100` | percent (`%`) |
| **7** | **Pod Memory Usage (cAdvisor)** | Time Series | `sum(container_memory_working_set_bytes{namespace="task-manager", container=~"backend\|frontend"}) by (pod, container)` | bytes |

---

## 5. Deployment and Verification

### A. Apply All Monitoring Resources
```bash
# 1. Create monitoring namespace
kubectl apply -f monitoring/namespace.yaml

# 2. Deploy Metrics Server (with --kubelet-insecure-tls for Docker Desktop)
kubectl apply -f monitoring/metrics-server.yaml

# 3. Deploy Prometheus stack
kubectl apply -f monitoring/prometheus/

# 4. Deploy Grafana stack
kubectl apply -f monitoring/grafana/

# 5. Wait for rollouts
kubectl rollout status deployment/prometheus -n monitoring --timeout=120s
kubectl rollout status deployment/grafana -n monitoring --timeout=120s
```

Or run the one-click PowerShell script on Windows:
```powershell
powershell -ExecutionPolicy Bypass -File .\monitoring\deploy.ps1
```

### B. Verify Resource Metrics via Metrics Server
```bash
# Node CPU and Memory:
kubectl top nodes

# Pod CPU and Memory across namespaces:
kubectl top pods -n task-manager
kubectl top pods -n monitoring
```

### C. Verify Prometheus Scrape Targets
Run port-forward to inspect Prometheus directly:
```bash
kubectl port-forward svc/prometheus-service 9090:9090 -n monitoring
```
Open **`http://localhost:9090/targets`**:
- `task-manager-backend`: **UP** (Scraping `backend-service.task-manager.svc.cluster.local:3000/metrics`)
- `kubernetes-cadvisor`: **UP** (Scraping `/api/v1/nodes/proxy/metrics/cadvisor`)
- `prometheus`: **UP** (Self-monitoring)

### D. Access Grafana Dashboards
Run port-forward to access Grafana on host port **`3001`**:
```bash
kubectl port-forward svc/grafana-service 3001:3000 -n monitoring
```
- **URL**: `http://localhost:3001`
- **Username**: `admin`
- **Password**: `devops-monitoring-admin`
- **Dashboard Path**: Dashboards $\rightarrow$ Folder: **Task Manager** $\rightarrow$ **Task Management System — Operations Overview**

---

## 6. Security & Resource Controls

1. **Non-Root Execution**:
   - Prometheus runs under UID/GID `65534:65534` (`nobody`).
   - Grafana runs under UID/GID `472:472` (`grafana`).
2. **Resource Requests & Limits**:
   - Both Prometheus and Grafana specify requests (`100m CPU`, `128Mi RAM`) and limits (`500m CPU`, `512Mi RAM`) to prevent resource exhaustion on Docker Desktop.
3. **Internal-Only Services**:
   - Neither Prometheus nor Grafana is exposed through LoadBalancer services or publicly on external IPs. Access is strictly controlled via `kubectl port-forward` or in-cluster networking.
4. **Credential Management**:
   - Grafana credentials are provided via Kubernetes Secret `grafana-secret` and loaded through environment variables `GF_SECURITY_ADMIN_USER` and `GF_SECURITY_ADMIN_PASSWORD`.

---

## 7. Cleanup Instructions

To remove the monitoring stack without affecting the application:
```bash
kubectl delete namespace monitoring
```
*(Optionally remove metrics-server: `kubectl delete -f monitoring/metrics-server.yaml`).*
