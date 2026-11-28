# Phase 8: Centralized Logging with Fluentd

This directory provides centralized log collection and aggregation for the **Task Management System** on Kubernetes using a **Fluentd DaemonSet** as required by Phase 8 of the DevOps capstone assignment.

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
│  │ 6. Output (@type file): Writes daily structured JSON files to centralized storage         │  │
│  └─────────────────────────────────────────────┬─────────────────────────────────────────────┘  │
│                                                │                                                │
│                                                ▼                                                │
│                                 /var/log/fluentd-central/                                       │
│                                 ├── application/                                                │
│                                 │   └── app.YYYYMMDD.log (Pino application logs)                │
│                                 └── infrastructure/                                             │
│                                     └── infra.YYYYMMDD.log (K8s and system logs)                │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```text
logging/
├── README.md          # Architecture, deployment, verification, and troubleshooting
├── namespace.yaml     # Dedicated 'logging' namespace definition
├── rbac.yaml          # ServiceAccount, read-only ClusterRole (pods, namespaces), ClusterRoleBinding
├── configmap.yaml     # Fluentd pipeline configuration (fluent.conf) with file output
├── daemonset.yaml     # Fluentd DaemonSet with official image, tolerations, resource limits
└── deploy.ps1         # One-click deployment script
```

---

## 3. Deployment & Verification

### Deploy with PowerShell
```powershell
powershell -ExecutionPolicy Bypass -File .\logging\deploy.ps1
```

### Validate Deployment Health
```powershell
kubectl get ds,pods -n logging
kubectl rollout status daemonset/fluentd -n logging
```

### Inspect Collected Logs
```powershell
# Application logs
kubectl exec -n logging ds/fluentd -- tail -n 20 /var/log/fluentd-central/application/app.YYYYMMDD.log

# Infrastructure logs
kubectl exec -n logging ds/fluentd -- tail -n 20 /var/log/fluentd-central/infrastructure/infra.YYYYMMDD.log
```
