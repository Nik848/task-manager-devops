# Task Management System — Complete Kubernetes Deployment Guide

This directory contains the production-ready Kubernetes infrastructure manifests and deployment automation for the **Task Management System** monorepo.

---

## 1. Kubernetes Architecture Overview

The application is deployed across a dedicated namespace (`task-manager`), orchestrating a decoupled, scalable, multi-tier microservice architecture:

```
                              [ User Browser ]
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │         Frontend Service (LoadBalancer)       │
               │           Port 80 (Maps to localhost)        │
               │   (Optional: Ingress: task-manager.local)    │
               └──────────────────────┬───────────────────────┘
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
               ┌───────────────────┐     ┌───────────────────┐
               │   Frontend Pod    │     │   Frontend Pod    │
               │ (Nginx 1.27 +     │     │ (Nginx 1.27 +     │
               │  React 18 SPA)    │     │  React 18 SPA)    │
               └─────────┬─────────┘     └─────────┬─────────┘
                         │ (Proxy /api/* & /health)│
                         └────────────┬────────────┘
                                      ▼
               ┌──────────────────────────────────────────────┐
               │          Backend Service (ClusterIP)         │
               │             Internal Port: 3000              │
               └──────────────────────┬───────────────────────┘
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
               ┌───────────────────┐     ┌───────────────────┐
               │    Backend Pod    │     │    Backend Pod    │
               │ (Node 20 Express, │     │ (Node 20 Express, │
               │  JWT Auth, Drizzle│     │  JWT Auth, Drizzle│
               │  Pino & Prom)     │     │  Pino & Prom)     │
               └─────────┬─────────┘     └─────────┬─────────┘
                         │                         │
                         ▼                         ▼
         ┌─────────────────────────────────────────────────────────┐
         │              External Cloud Database                    │
         │           Supabase Managed PostgreSQL                   │
         └─────────────────────────────────────────────────────────┘
```

### Key Supporting Components:
- **`ConfigMap` (`task-manager-config`)**: Injects non-sensitive environment variables (`NODE_ENV`, `PORT`, `CORS_ORIGIN`, `LOG_LEVEL`, `ADMIN_NAME`).
- **`Secret` (`task-manager-secret`)**: Safely stores sensitive credentials (`DATABASE_URL`, `JWT_SECRET`, admin credentials).
- **`PersistentVolume` & `PersistentVolumeClaim` (`postgres-pv`, `postgres-pvc`)**: Demonstrates bound local hostPath storage (`manual` storage class, 1Gi) to fulfill academic stateful storage criteria without modifying the live Supabase database.
- **`RBAC` (`task-manager-operator`, `task-manager-role`, `task-manager-rolebinding`)**: Grants granular operational permissions restricted strictly to the `task-manager` namespace without unnecessary cluster-admin privileges.

---

## 2. Directory Structure

```text
k8s/
├── namespace.yaml             # Dedicated 'task-manager' namespace
├── configmap.yaml             # Non-sensitive configuration variables
├── secret.yaml                # Secret template with placeholders (safe for Git)
├── backend-deployment.yaml    # Node.js Express API Deployment (2 replicas, probes, securityContext)
├── backend-service.yaml       # ClusterIP Service exposing backend on port 3000
├── frontend-deployment.yaml   # React + Nginx Deployment (2 replicas, non-root user)
├── frontend-service.yaml      # LoadBalancer Service exposing frontend on port 80 (localhost)
├── ingress.yaml               # Ingress routing /api to backend and / to frontend
├── postgres-pv.yaml           # PersistentVolume specification (1Gi)
├── postgres-pvc.yaml          # PersistentVolumeClaim bound to postgres-pv
├── rbac.yaml                  # ServiceAccount, Role, and RoleBinding (Least Privilege)
├── deploy.ps1                 # Automated PowerShell deployment script
└── README.md                  # Comprehensive documentation and verification manual
```

---

## 3. Prerequisites

Ensure the following tools are installed and available in your environment:
1. **Kubernetes Cluster**: Docker Desktop with Kubernetes enabled, Minikube, Kind, or a remote managed cluster (EKS/GKE/AKS).
2. **`kubectl` CLI**: Version v1.26 or newer (`kubectl version --client`).
3. **Docker Engine**: For building container images (`docker version`).
4. **PowerShell** (Windows) or **Bash** (Linux / macOS).

Verify cluster access:
```bash
kubectl cluster-info
kubectl get nodes
```

---

## 4. Docker Image Management & Registry Configuration

### A. Local Image Build (Default for Docker Desktop / Minikube)
Build and tag the images locally. The Kubernetes manifests default to `imagePullPolicy: IfNotPresent`, enabling instant local deployment:

```powershell
# From project root:
docker build -t task-manager-devops-backend:v1.0.0 -t task-manager-devops-backend:latest ./app/backend
docker build -t task-manager-devops-frontend:v1.0.0 -t task-manager-devops-frontend:latest ./app/frontend

# Tag a v1.0.1 image to demonstrate rolling updates:
docker tag task-manager-devops-backend:v1.0.0 task-manager-devops-backend:v1.0.1
```

### B. GitHub Container Registry (GHCR) Configuration (Production Ready)
To push and run images from GHCR:

1. **Authenticate with GHCR**:
   Generate a GitHub Personal Access Token (Classic) with `write:packages` and `read:packages` scopes.
   ```bash
   echo $CR_PAT | docker login ghcr.io -u <YOUR_GITHUB_USERNAME> --password-stdin
   ```

2. **Tag images for GHCR**:
   ```bash
   docker tag task-manager-devops-backend:v1.0.0 ghcr.io/<YOUR_GITHUB_USERNAME>/task-manager-devops-backend:v1.0.0
   docker tag task-manager-devops-frontend:v1.0.0 ghcr.io/<YOUR_GITHUB_USERNAME>/task-manager-devops-frontend:v1.0.0
   ```

3. **Push to GHCR**:
   ```bash
   docker push ghcr.io/<YOUR_GITHUB_USERNAME>/task-manager-devops-backend:v1.0.0
   docker push ghcr.io/<YOUR_GITHUB_USERNAME>/task-manager-devops-frontend:v1.0.0
   ```

4. **Create Image Pull Secret in Kubernetes** (for private images):
   ```bash
   kubectl create secret docker-registry ghcr-secret \
     --namespace=task-manager \
     --docker-server=ghcr.io \
     --docker-username=<YOUR_GITHUB_USERNAME> \
     --docker-password=$CR_PAT \
     --docker-email=<YOUR_EMAIL>
   ```
   Add `imagePullSecrets: [{name: ghcr-secret}]` under `spec.template.spec` in your deployments.

---

## 5. Secret Configuration

### Secure Handling
To avoid committing database passwords or signing keys to version control:
- [k8s/secret.yaml](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/k8s/secret.yaml) contains non-sensitive placeholders.
- When running `deploy.ps1`, the script automatically detects your existing [app/backend/.env](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/app/backend/.env) and securely provisions `task-manager-secret` in memory without writing it to disk.

### Manual Secret Creation
If creating manually with `kubectl`:
```bash
kubectl create secret generic task-manager-secret \
  --namespace=task-manager \
  --from-literal=DATABASE_URL="postgresql://postgres.[ref]:[pass]@[host]:6543/postgres" \
  --from-literal=JWT_SECRET="your-256-bit-jwt-secret-string" \
  --from-literal=ADMIN_EMAIL="admin@example.com" \
  --from-literal=ADMIN_PASSWORD="changeme123"
```

---

## 6. Deployment Instructions

### Option A: Automated Deployment via PowerShell (Recommended)
Run the automated deployment script from the project root:
```powershell
powershell -ExecutionPolicy Bypass -File .\k8s\deploy.ps1
```
The script automatically:
1. Validates `kubectl` and cluster connectivity.
2. Creates the `task-manager` namespace.
3. Applies ConfigMap and provisions Secret from local `.env`.
4. Provisions Persistent Volume (`postgres-pv`) and Claim (`postgres-pvc`).
5. Configures RBAC ServiceAccount and RoleBindings.
6. Deploys Backend & Frontend Services and Deployments.
7. Waits for rollout completion and prints endpoints.

### Option B: Step-by-Step Manual Deployment (Linux / macOS / PowerShell)
```bash
# 1. Create Namespace
kubectl apply -f k8s/namespace.yaml

# 2. Apply ConfigMap
kubectl apply -f k8s/configmap.yaml

# 3. Create or Apply Secret
# (Ensure secret.yaml has real values or use kubectl create secret generic)
kubectl apply -f k8s/secret.yaml

# 4. Apply Storage Manifests
kubectl apply -f k8s/postgres-pv.yaml
kubectl apply -f k8s/postgres-pvc.yaml

# 5. Apply RBAC
kubectl apply -f k8s/rbac.yaml

# 6. Apply Services
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-service.yaml

# 7. Apply Deployments
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# 8. (Optional) Apply Ingress
kubectl apply -f k8s/ingress.yaml

# 9. Verify Rollout Status
kubectl rollout status deployment/backend -n task-manager
kubectl rollout status deployment/frontend -n task-manager
```

---

## 7. Service Access & Verification

### Web Interface (Frontend)
- **Direct Localhost**: Open **`http://localhost`** in your browser. The `frontend-service` (LoadBalancer) maps port 80 directly to your host.
- **NodePort Alternative**: If LoadBalancer external IP is not supported in your cluster, access via `http://localhost:<NodePort>` (check using `kubectl get svc -n task-manager frontend-service`).
- **Ingress URL**: If using an Ingress controller, add `127.0.0.1 task-manager.local` to your `hosts` file and browse to `http://task-manager.local`.

### Backend API Endpoints (Proxied via Frontend & Ingress)
All frontend API requests are reverse-proxied internally by Nginx to `backend-service:3000`:
- **Health Check**: `curl.exe http://localhost/health`
  ```json
  {"status":"ok","db":"connected","timestamp":"..."}
  ```
- **Prometheus Metrics**: `curl.exe http://localhost/metrics` (or port-forward backend service on 3000)

---

## 8. College Capstone Demonstration Walkthrough

Below are the exact commands to execute and present during evaluation:

### A. Inspect Running Resources
```bash
kubectl get all -n task-manager
kubectl get pv,pvc -n task-manager
```

### B. Demonstrate Horizontal Pod Scaling
Scale backend replicas from 2 to 3:
```bash
kubectl scale deployment/backend --replicas=3 -n task-manager
kubectl rollout status deployment/backend -n task-manager
kubectl get pods -n task-manager -l app=backend
```
*Expected Result*: 3 pods are in `1/1 Running` state.

Scale back to 2 replicas:
```bash
kubectl scale deployment/backend --replicas=2 -n task-manager
```

### C. Demonstrate Zero-Downtime Rolling Update
Update the backend deployment image to version `v1.0.1`:
```bash
kubectl set image deployment/backend backend=task-manager-devops-backend:v1.0.1 -n task-manager
kubectl rollout status deployment/backend -n task-manager
```
*Expected Result*: Kubernetes sequentially replaces old pods with new pods with zero downtime (governed by `maxSurge: 1, maxUnavailable: 0` and readiness probes).

View rollout history:
```bash
kubectl rollout history deployment/backend -n task-manager
```

### D. Demonstrate Instant Rollback
Revert back to the previous stable release:
```bash
kubectl rollout undo deployment/backend -n task-manager
kubectl rollout status deployment/backend -n task-manager
kubectl get pods -n task-manager -l app=backend
```
*Expected Result*: Deployment transitions back to revision 1 without dropped connections.

### E. Demonstrate Persistent Storage
Check that the PersistentVolume and PersistentVolumeClaim are properly bound:
```bash
kubectl get pv postgres-pv
kubectl get pvc postgres-pvc -n task-manager
```
*Expected Result*: `STATUS: Bound` on both resources.

### F. Demonstrate RBAC Least-Privilege Enforcement
Test operator permissions:
```bash
# Permitted actions (returns 'yes'):
kubectl auth can-i create deployments --as=system:serviceaccount:task-manager:task-manager-operator -n task-manager
kubectl auth can-i delete pods --as=system:serviceaccount:task-manager:task-manager-operator -n task-manager

# Denied cluster-level actions (returns 'no'):
kubectl auth can-i create nodes --as=system:serviceaccount:task-manager:task-manager-operator -n task-manager
kubectl auth can-i delete namespaces --as=system:serviceaccount:task-manager:task-manager-operator
```

---

## 9. Troubleshooting & Diagnostics

| Problem | Cause | Diagnostic Command & Fix |
| :--- | :--- | :--- |
| **Pod stuck in `CrashLoopBackOff`** | Incorrect environment variables or failed DB connection | `kubectl logs deployment/backend -n task-manager`<br>Check `DATABASE_URL` in `task-manager-secret`. |
| **Pod stuck in `0/1 Running`** | Readiness probe failing | `kubectl describe pod <pod-name> -n task-manager`<br>Ensure database endpoint `/health` is responding with HTTP 200. |
| **`ImagePullBackOff`** | Image not built locally or invalid image tag | `docker images \| grep task-manager`<br>Ensure images are built with `v1.0.0` tags. |
| **Frontend cannot reach Backend** | Nginx cannot resolve `backend-service` | Verify backend service exists: `kubectl get svc -n task-manager backend-service`. |

---

## 10. Suggested Screenshots for College Submission

1. **`01_kubectl_get_all.png`**: Output of `kubectl get all -n task-manager` showing all pods, deployments, and services running.
2. **`02_browser_app.png`**: The React Task Manager interface open at `http://localhost` showing logged-in user dashboard and task list.
3. **`03_health_check.png`**: Terminal running `curl http://localhost/health` displaying `{"status":"ok","db":"connected"}`.
4. **`04_scaling_demo.png`**: Terminal showing `kubectl scale deployment/backend --replicas=3` and the resulting 3 pods running.
5. **`05_rolling_update_and_rollback.png`**: Output of `kubectl set image` followed by `kubectl rollout undo` showing revision history.
6. **`06_pv_pvc_bound.png`**: Output of `kubectl get pv,pvc -n task-manager` confirming `Bound` status.
7. **`07_rbac_auth_can_i.png`**: Output of `kubectl auth can-i` demonstrating restricted serviceaccount permissions.
