# Phase 10: Blue-Green Deployment Strategy

This guide documents the **Blue-Green Deployment** implementation for the **Task Management System** on Kubernetes (`task-manager` namespace).

---

## 1. Blue-Green Architecture

Blue-Green deployment maintains two independent, identical application environments—**Blue** (current active stable version) and **Green** (candidate new version)—while routing production traffic through the existing `frontend-service` and `backend-service` via Kubernetes label selectors (`version: blue` or `version: green`).

```text
                                 [ User Browser: http://localhost ]
                                                 │
                                                 ▼
                           ┌───────────────────────────────────────────┐
                           │  frontend-service (LoadBalancer :80)      │
                           │  Selector: app=frontend, version=<active> │
                           └─────────┬───────────────────────┬─────────┘
                                     │ (Active: blue)        │ (Idle / Candidate: green)
                                     ▼                       ▼
                    ┌─────────────────────────┐     ┌─────────────────────────┐
                    │ frontend-blue (2/2)     │     │ frontend-green (2/2)    │
                    │ taskmanager-frontend:   │     │ taskmanager-frontend:   │
                    │ v1.0.1                  │     │ v2.0.0-green            │
                    └────────────┬────────────┘     └────────────┬────────────┘
                                 │                               │
                                 ▼                               ▼
                           ┌───────────────────────────────────────────┐
                           │  backend-service (ClusterIP :3000)        │
                           │  Selector: app=backend, version=<active>  │
                           └─────────┬───────────────────────┬─────────┘
                                     │ (Active: blue)        │ (Idle / Candidate: green)
                                     ▼                       ▼
                    ┌─────────────────────────┐     ┌─────────────────────────┐
                    │ backend-blue (2/2)      │     │ backend-green (2/2)     │
                    │ taskmanager-backend:    │     │ taskmanager-backend:    │
                    │ v1.0.0                  │     │ v2.0.0-green            │
                    └────────────┬────────────┘     └────────────┬────────────┘
                                 │                               │
                                 └───────────────┬───────────────┘
                                                 ▼
                         ┌───────────────────────────────────────────────┐
                         │ Shared ConfigMap, Secret, PVC & Supabase DB   │
                         │ • task-manager-config / task-manager-secret   │
                         │ • task-manager-pvc (single-node hostPath)     │
                         │ • Supabase Managed PostgreSQL                 │
                         └───────────────────────────────────────────────┘
```

---

## 2. Manifests & Script Layout

- `k8s/blue-green/backend-blue.yaml`: Blue backend Deployment (`taskmanager-backend:v1.0.0`, 2 replicas, `version: blue`).
- `k8s/blue-green/frontend-blue.yaml`: Blue frontend Deployment (`taskmanager-frontend:v1.0.1`, 2 replicas, `version: blue`).
- `k8s/blue-green/backend-green.yaml`: Green backend Deployment (`taskmanager-backend:v2.0.0-green`, 2 replicas, `version: green`).
- `k8s/blue-green/frontend-green.yaml`: Green frontend Deployment (`taskmanager-frontend:v2.0.0-green`, 2 replicas, `version: green`).
- `k8s/blue-green.ps1`: PowerShell controller supporting `status`, `deploy-blue`, `deploy-green`, `switch-green`, and `rollback-blue`.

All deployments preserve non-root security contexts (`UID 1001` backend, `UID 101` frontend), `automountServiceAccountToken: false`, readiness/liveness probes, and resource requests/limits.

---

## 3. Deployment, Switching, and Rollback Workflow

### A. Check Current Status
```powershell
powershell -ExecutionPolicy Bypass -File .\k8s\blue-green.ps1 -Action status
```

### B. Deploy Initial Blue Environment
```powershell
powershell -ExecutionPolicy Bypass -File .\k8s\blue-green.ps1 -Action deploy-blue
```

### C. Deploy & Independently Verify Green Candidate (Zero Production Impact)
Builds `v2.0.0-green` images, deploys `backend-green` and `frontend-green`, waits for `2/2` Ready, and verifies `/health` and `/` via `kubectl port-forward` **without** switching production traffic:
```powershell
powershell -ExecutionPolicy Bypass -File .\k8s\blue-green.ps1 -Action deploy-green
```

### D. Switch Production Traffic to Green
Runs safety gates (verifies Green exists and all replicas are Ready), updates `backend-service` and `frontend-service` selectors to `version=green`, verifies endpoints, and tests `http://localhost/health` and `http://localhost/`:
```powershell
powershell -ExecutionPolicy Bypass -File .\k8s\blue-green.ps1 -Action switch-green
```

### E. Instant Rollback to Blue
Because Blue remains running and intact during the switch, rolling back only updates the Service selectors back to `version=blue`:
```powershell
powershell -ExecutionPolicy Bypass -File .\k8s\blue-green.ps1 -Action rollback-blue
```

---

## 4. Safety Controls & Shared Database Considerations

1. **Failure Safety**: `switch-green` and `rollback-blue` refuse to switch traffic if the target deployments are missing or not Ready (`readyReplicas != replicas`), leaving the active environment untouched.
2. **Non-Destructive Switching**: Switching to Green does **not** delete Blue, enabling instant selector-based rollback.
3. **Shared Supabase Database**:
   - Both Blue and Green share `task-manager-secret` (`DATABASE_URL`) and the same live Supabase PostgreSQL database.
   - Do **not** run two database migration jobs simultaneously across Blue and Green.
   - Any schema changes introduced by Green **must remain backward-compatible** with Blue (expand-and-contract pattern) during the deployment and rollback window.

---

## 5. Jenkins Integration & Docker Desktop Limitations

- **Jenkins Integration**: `Jenkinsfile` remains focused on CI (lint, test, SonarQube static analysis, Docker build, Trivy vulnerability gate, and artifact packaging) and continues using `pollSCM` without automatically switching production traffic on every Git push. Blue-Green traffic switching is intentionally executed via the operator-controlled `k8s/blue-green.ps1` workflow on Windows PowerShell.
- **Docker Desktop Limitations**:
  - **Single-Node `ReadWriteOnce` PVC**: `task-manager-pvc` uses `hostPath` (`ReadWriteOnce`), which works across Blue and Green on single-node Docker Desktop (`desktop-control-plane`), but in a multi-node cluster `ReadWriteOnce` block storage cannot be mounted simultaneously across different nodes.
  - **Resource Overhead**: Running both Blue and Green (`8` application pods total) temporarily doubles cluster CPU/memory usage during the cutover window.
