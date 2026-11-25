# Phase 8: Centralized Logging with Fluentd

This directory provides lightweight, centralized log collection and aggregation for the **Task Management System** on Kubernetes using a **Fluentd DaemonSet**.

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
│  │ Fluentd DaemonSet (fluent/fluentd-kubernetes-daemonset:v1.17-debian-forward-1)            │  │
│  │ 1. Input (@type tail): Tails /var/log/containers/*.log (excludes fluentd*.log)            │  │
│  │ 2. Parser: Parses CRI log format (timestamp, stream, logtag, message)                     │  │
│  │ 3. Enrichment (@type kubernetes_metadata): Attaches namespace, pod, container, labels     │  │
│  │ 4. JSON Parsing (@type parser): Parses Pino JSON payloads for task-manager pods           │  │
│  │ 5. Routing & Tagging: Separates log_category="application" vs "infrastructure"            │  │
│  └──────────────────────────┬────────────────────────────────────┬───────────────────────────┘  │
│                             │                                    │                              │
│                             ▼                                    ▼                              │
│  /var/log/fluentd-central/application/       /var/log/fluentd-central/infrastructure/           │
│  • app.YYYYMMDD.log (JSON records)           • infra.YYYYMMDD.log (JSON records)                │
│  (Backed by node hostPath: /var/log/fluentd-central)                                            │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```text
logging/
├── README.md          # Architecture, storage, retention, deployment, and verification guide
├── namespace.yaml     # Dedicated 'logging' namespace definition
├── rbac.yaml          # ServiceAccount, read-only ClusterRole (pods, namespaces), ClusterRoleBinding
├── configmap.yaml     # Fluentd pipeline configuration (fluent.conf)
├── daemonset.yaml     # Fluentd DaemonSet with tolerations, resource limits, and hostPath mounts
└── deploy.ps1         # One-click PowerShell deployment script for Windows
```

---

## 3. Components & Security Controls

1. **Pinned Image**: Uses `fluent/fluentd-kubernetes-daemonset:v1.17-debian-forward-1` (Fluentd `1.17.1` with `fluent-plugin-kubernetes_metadata_filter`).
2. **Least-Privilege RBAC**: The `fluentd` ServiceAccount is bound to a ClusterRole granting read-only (`get`, `list`, `watch`) access exclusively to `pods` and `namespaces`. It has **no** access to `secrets` or `configmaps`.
3. **Node Log Access Context**: On Docker Desktop (`desktop-control-plane`), `/var/log/pods` is owned by `root:root` with mode `0750` (`drwxr-x---`). Because `/var/log/containers/*.log` symlinks resolve into `/var/log/pods`, Fluentd runs with `allowPrivilegeEscalation: false` and default container UID `0` to read host container logs without permission errors. Host log mounts (`/var/log` and `/var/lib/docker/containers`) are strictly `readOnly: true`.
4. **Self-Logging Prevention**: `exclude_path` explicitly ignores `/var/log/containers/fluentd*.log` and `/var/log/containers/*_logging_fluentd-*.log` to prevent recursive log loops.
5. **No Public Exposure**: No Kubernetes `Service`, `NodePort`, or `LoadBalancer` is created.
6. **No Secret Collection**: Fluentd only tails container `stdout`/`stderr` streams and enriches with pod/namespace metadata; environment variables and Secret values are never read.

---

## 4. Centralized Log Storage & Retention

- **Storage Location**: Collected logs are written as newline-delimited JSON files inside the container at `/var/log/fluentd-central/`, backed by a `hostPath` volume at `/var/log/fluentd-central` on the Kubernetes node (`desktop-control-plane`):
  - **Application logs** (`namespace=task-manager`): `/var/log/fluentd-central/application/app.YYYYMMDD.log` (`log_category: "application"`)
  - **Infrastructure logs** (all other namespaces, e.g., `kube-system`, `monitoring`): `/var/log/fluentd-central/infrastructure/infra.YYYYMMDD.log` (`log_category: "infrastructure"`)
- **Retention & Rotation**: Fluentd buffers flush every `5s` into daily time-sliced files (`timekey 1d`). No automatic age-based deletion/purging is configured inside Fluentd; files accumulate daily until manually cleaned or rotated by the host.
- **Persistence Behavior**:
  - **Pod Deletion**: Because `/var/log/fluentd-central` uses `hostPath` (`DirectoryOrCreate`) on the single node, collected log files **survive Fluentd pod restarts or deletions** on that same node (state/position tracking `pos_file` is stored in `emptyDir` `/fluentd/state`, so a restarted pod re-reads from head if `emptyDir` is cleared).
  - **Cluster Restart / Multi-Node Limitations**: Data is bound to the Docker Desktop Linux VM/node filesystem. It does **not** replicate across nodes in a multi-node cluster and will be lost if the Docker Desktop VM data or Kubernetes cluster is reset/destroyed.

---

## 5. Deployment & Verification

### A. Deploy with PowerShell
```powershell
powershell -ExecutionPolicy Bypass -File .\logging\deploy.ps1
```

### B. Validate Fluentd Configuration & DaemonSet Health
```powershell
kubectl get ds,pods,svc -n logging
kubectl exec -n logging ds/fluentd -- fluentd --dry-run -c /fluentd/etc/fluent.conf
```

### C. Verify Application, Container, and Kubernetes Logs
```powershell
# 1. Generate live traffic to backend and frontend
curl.exe -s http://localhost/health
curl.exe -s http://localhost/api/tasks
curl.exe -s http://localhost/

# 2. Verify Backend Pino JSON application logs (parsed fields + log_category="application")
kubectl exec -n logging ds/fluentd -- sh -c "grep 'request completed' /var/log/fluentd-central/application/app.$(Get-Date -UFormat %Y%m%d).log | tail -n 2"

# 3. Verify Frontend Nginx container logs
kubectl exec -n logging ds/fluentd -- sh -c "grep 'frontend' /var/log/fluentd-central/application/app.$(Get-Date -UFormat %Y%m%d).log | tail -n 2"

# 4. Verify Kubernetes infrastructure logs & metadata (namespace, pod, container, labels)
kubectl exec -n logging ds/fluentd -- sh -c "grep 'kube-system' /var/log/fluentd-central/infrastructure/infra.$(Get-Date -UFormat %Y%m%d).log | tail -n 2"

# 5. Confirm Fluentd's own logs are excluded (returns 0)
kubectl exec -n logging ds/fluentd -- sh -c "grep -c 'fluentd-' /var/log/fluentd-central/infrastructure/infra.$(Get-Date -UFormat %Y%m%d).log || true"
```
