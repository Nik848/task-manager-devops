# Phase 8: Centralized Logging with Fluentd → Loki → Grafana

This directory provides centralized log collection, aggregation, and **searchable log viewing** for the **Task Management System** on Kubernetes using a **Fluentd DaemonSet** as the collector and **Grafana Loki** as the log store, with logs searchable in **Grafana**.

---

## 1. Logging Architecture

```text
                                 Kubernetes Cluster (docker-desktop)
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                 │
│  [Node: desktop-control-plane]                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Container Runtime (containerd) -> /var/log/containers/*.log -> /var/log/pods/...          │  │
│  │ • task-manager/backend (Pino JSON stdout)                                                 │  │
│  │ • task-manager/frontend (Nginx stdout/stderr)                                             │  │
│  │ • kube-system/*, monitoring/* (Infrastructure & Control-Plane stdout/stderr)              │  │
│  └─────────────────────────────────────────────┬─────────────────────────────────────────────┘  │
│                                                │ (Read-only hostPath tailing)                   │
│                                                ▼                                                │
│  [Namespace: logging]                                                                           │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Fluentd DaemonSet (fluentd-loki:v1.17-1 — custom image with Loki plugin)                 │  │
│  │ 1. Input (@type tail): Tails /var/log/containers/*.log (excludes fluentd*.log)            │  │
│  │ 2. Parser: Parses CRI log format (timestamp, stream, logtag, message)                     │  │
│  │ 3. Enrichment (@type kubernetes_metadata): Attaches namespace, pod, container, labels     │  │
│  │ 4. JSON Parsing (@type parser): Parses Pino JSON payloads for task-manager pods           │  │
│  │ 5. Routing & Tagging: Separates log_category="application" vs "infrastructure"            │  │
│  │ 6. Level Mapping: Converts Pino numeric levels (30→info, 50→error, etc.)                  │  │
│  │ 7. Output (@type copy): Sends to BOTH file storage AND Loki                               │  │
│  └──────────────┬──────────────────────────┬──────────────────────────┬──────────────────────┘  │
│                 │                          │                          │                          │
│                 ▼                          ▼                          ▼                          │
│  /var/log/fluentd-central/     Loki (grafana/loki:3.0.0)       Grafana (v10.4.0)               │
│  ├── application/              • ClusterIP :3100               • Loki datasource (uid: loki)   │
│  │   └── app.YYYYMMDD.log     • Filesystem storage (PVC)      • Dashboard: Task Manager Logs  │
│  └── infrastructure/           • TSDB index, auth disabled     └──────────────────────────────  │
│      └── infra.YYYYMMDD.log   • Labels: namespace, pod,          (port-forward :3001)          │
│                                  container, log_category, level                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```text
logging/
├── README.md              # Architecture, deployment, verification, and troubleshooting
├── Dockerfile             # Custom Fluentd image with fluent-plugin-grafana-loki gem
├── namespace.yaml         # Dedicated 'logging' namespace definition
├── rbac.yaml              # ServiceAccount, read-only ClusterRole (pods, namespaces), ClusterRoleBinding
├── configmap.yaml         # Fluentd pipeline configuration (fluent.conf) with file + Loki outputs
├── daemonset.yaml         # Fluentd DaemonSet with custom image, tolerations, resource limits
├── loki-configmap.yaml    # Loki server configuration (monolithic mode, filesystem storage)
├── loki-storage.yaml      # PersistentVolume + PersistentVolumeClaim for Loki data
├── loki-deployment.yaml   # Loki Deployment (non-root UID 10001, read-only rootfs, PVC)
├── loki-service.yaml      # Loki ClusterIP service on port 3100
└── deploy.ps1             # One-click build + deploy script
```

---

## 3. Loki Labels (Low Cardinality)

| Label | Values | Scope |
|-------|--------|-------|
| `namespace` | `task-manager`, `kube-system`, `monitoring`, `logging`, `argocd`, … | All logs |
| `pod` | Pod name | All logs |
| `container` | Container name | All logs |
| `log_category` | `application` or `infrastructure` | All logs |
| `level` | `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `unknown` | Application only |

High-cardinality fields (reqId, URLs, timestamps, user IDs) are **not** labels — query them with LogQL `| json` on the log line.

---

## 4. Deployment & Verification

### A. Deploy with PowerShell (one command)
```powershell
powershell -ExecutionPolicy Bypass -File .\logging\deploy.ps1
```

The script:
1. Builds the custom Fluentd image (`fluentd-loki:v1.17-1`)
2. Deploys Loki (config, PV/PVC, deployment, service)
3. Deploys Fluentd DaemonSet with file + Loki outputs
4. Updates Grafana datasources (adds Loki) and dashboard ConfigMap
5. Restarts Grafana to pick up the new datasource
6. Waits for all rollouts

### B. Validate Deployment Health
```powershell
kubectl get pods -n logging
kubectl get svc -n logging
kubectl rollout status deployment/loki -n logging
kubectl rollout status daemonset/fluentd -n logging
```

### C. Verify Logs Arrive in Loki
```powershell
# Port-forward Loki and query labels
kubectl port-forward svc/loki 3100:3100 -n logging

# In another terminal:
curl http://localhost:3100/loki/api/v1/labels

# Query application logs
curl -G http://localhost:3100/loki/api/v1/query_range --data-urlencode 'query={log_category="application"}' --data-urlencode 'limit=5'

# Query infrastructure logs
curl -G http://localhost:3100/loki/api/v1/query_range --data-urlencode 'query={log_category="infrastructure"}' --data-urlencode 'limit=5'

# Query container logs for a specific namespace
curl -G http://localhost:3100/loki/api/v1/query_range --data-urlencode 'query={namespace="kube-system"}' --data-urlencode 'limit=5'
```

### D. Verify File Output Still Works
```powershell
kubectl exec -n logging ds/fluentd -- ls -la /var/log/fluentd-central/application
kubectl exec -n logging ds/fluentd -- ls -la /var/log/fluentd-central/infrastructure
```

---

## 5. Example LogQL Queries

Use these in Grafana's Explore view (select the Loki datasource) or via the Loki API:

```logql
# 1. Errors in the application (task-manager backend)
{namespace="task-manager", log_category="application", level="error"} | json

# 2. Find a single request by reqId
{namespace="task-manager", log_category="application"} | json | reqId="abc-123-def"

# 3. All logs for a specific pod
{pod="backend-deployment-6b8f9c7d4-x2k9z"} | json

# 4. Errors in kube-system
{namespace="kube-system"} |= "error"

# 5. Log volume by namespace (metric query)
sum by (namespace) (count_over_time({namespace=~".+"} [5m]))
```

---

## 6. Components & Security Controls

1. **Custom Fluentd Image**: Built from `fluent/fluentd-kubernetes-daemonset:v1.17-debian-forward-1` with `fluent-plugin-grafana-loki` gem v1.2.20 pinned.
2. **Loki**: `grafana/loki:3.0.0` in monolithic mode with TSDB index on filesystem PVC. Auth disabled. Runs as non-root (UID 10001) with read-only root filesystem.
3. **Least-Privilege RBAC**: The `fluentd` ServiceAccount has read-only access to `pods` and `namespaces` only. No access to Secrets.
4. **Self-Logging Prevention**: `exclude_path` ignores Fluentd's own logs.
5. **Buffering & Resilience**: Loki output uses file-backed buffers with retry limits (5 retries, 32MB total limit) to prevent memory exhaustion if Loki is down.
6. **No Public Exposure**: Loki is a ClusterIP service (no NodePort/LoadBalancer).

---

## 7. Centralized Log Storage & Retention

- **File Storage**: Logs continue to be written to `/var/log/fluentd-central/` via hostPath (unchanged from Phase 8 original).
- **Loki Storage**: Log data stored in a 2Gi PVC backed by hostPath at `/var/lib/loki-data`. Survives pod restarts on the same node.
- **Retention**: No automatic retention or compaction configured. Data accumulates until manually cleaned.

---

## 8. Troubleshooting

### Loki Not Ready
```powershell
kubectl logs deployment/loki -n logging --tail=50
kubectl describe pod -l app=loki -n logging
# Check PVC is bound:
kubectl get pvc -n logging
```

### No Logs Showing in Grafana
1. Check Fluentd is running and not crashing:
   ```powershell
   kubectl logs ds/fluentd -n logging --tail=50
   ```
2. Check Fluentd can reach Loki:
   ```powershell
   kubectl exec -n logging ds/fluentd -- curl -s http://loki.logging.svc.cluster.local:3100/ready
   ```
3. Verify labels exist in Loki:
   ```powershell
   kubectl port-forward svc/loki 3100:3100 -n logging
   curl http://localhost:3100/loki/api/v1/labels
   ```
4. Ensure Grafana was restarted after the Loki datasource was added.

### Fluentd Buffer Errors
```powershell
# Check buffer state
kubectl exec -n logging ds/fluentd -- ls -la /fluentd/state/

# If buffers are corrupt, restart Fluentd (emptyDir buffers are cleared)
kubectl rollout restart daemonset/fluentd -n logging
```
