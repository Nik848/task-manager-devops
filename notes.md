# 📘 Complete DevOps Engineering Notes: Task Management System

> **A Comprehensive, Beginner-Friendly Guide to Containerization, Kubernetes Orchestration, and Jenkins CI/CD**

---

## Table of Contents
1. [The Big Picture: What is DevOps and Why Do We Need It?](#1-the-big-picture-what-is-devops-and-why-do-we-need-it)
2. [The Application Architecture](#2-the-application-architecture)
3. [Containerization with Docker](#3-containerization-with-docker)
4. [Kubernetes (K8s): Production Orchestration](#4-kubernetes-k8s-production-orchestration)
5. [CI/CD Pipeline with Jenkins](#5-cicd-pipeline-with-jenkins)
6. [Security & Vulnerability Management](#6-security--vulnerability-management)
7. [Hands-On DevOps Operations & Cheat Sheet](#7-hands-on-devops-operations--cheat-sheet)

---

## 1. The Big Picture: What is DevOps and Why Do We Need It?

In traditional software development:
- **Developers** write code on their personal laptops.
- **Operations teams** take that code and try to manually install it on production servers.
- **The problem**: *"It worked on my machine!"* Different operating systems, missing software versions, and manual human errors caused frequent outages and slow releases.

### The DevOps Solution
**DevOps** bridges this gap using three core pillars:
1. **Containerization (Docker)**: Packages application code with its exact runtime, libraries, and settings so it runs identically anywhere.
2. **Container Orchestration (Kubernetes)**: Automates running, scaling, and self-healing multiple containers across servers.
3. **Continuous Integration & Continuous Deployment (Jenkins CI/CD)**: Automates testing, building, scanning, and deploying code every time a developer pushes to GitHub.

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Developer     │       │     GitHub      │       │     Jenkins     │       │   Kubernetes    │
│  Writes Code    │ ───►  │ (develop branch)│ ───►  │  Build, Test &  │ ───►  │   Production    │
│  & git push     │       │                 │       │   Scan Images   │       │   Deployment    │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

---

## 2. The Application Architecture

Our project is a full-stack **Task Management System** with authentication and database storage:

- **Backend**: Built with **Node.js 20 & Express.js**.
  - **Drizzle ORM**: Manages database queries and schema.
  - **Database**: Cloud-hosted **PostgreSQL on Supabase** (using pooler connections).
  - **Authentication**: **JWT (JSON Web Tokens)** + **bcryptjs** for hashing passwords.
  - **Observability**: **Pino** for structured logging, and **Prometheus** (`/metrics`) for monitoring.
- **Frontend**: Built with **React 18, Vite, and Tailwind CSS**.
  - Uses client-side routing (`react-router-dom`) with protected routes.
  - Displays user stats, task lists, and allows creating, editing, and deleting tasks.

---

## 3. Containerization with Docker (Phase 3 Implementation)

### Why Docker?
A container is a lightweight, isolated package containing everything the application needs to run:
- Code
- Node.js runtime
- Production dependencies (`node_modules`)
- Web server and reverse proxy configuration

### Docker Architecture
```
                                 Host Machine (Windows 11)
      ┌────────────────────────────────────────────────────────────────────────┐
      │                                                                        │
      │   Browser Access:                                                      │
      │   http://localhost:8080 ────────┐                                      │
      │                                 │                                      │
      │                        Docker Bridge Network                           │
      │                        (taskmanager-network)                           │
      │                                 │                                      │
      │                                 ▼                                      │
      │                   ┌───────────────────────────┐                        │
      │                   │   taskmanager-frontend    │                        │
      │                   │   (Nginx 1.27 Alpine)     │                        │
      │                   │   Port 80 (mapped: 8080)  │                        │
      │                   └─────────────┬─────────────┘                        │
      │                                 │ Reverse Proxy                        │
      │                                 │ /api/ and /health                    │
      │                                 ▼                                      │
      │                   ┌───────────────────────────┐                        │
      │                   │   taskmanager-backend     │                        │
      │                   │   (Node.js 20 Alpine)     │                        │
      │                   │   Port 3000 (mapped: 3000)│                        │
      │                   └─────────────┬─────────────┘                        │
      │                                 │ SSL Pooler Connection                │
      └─────────────────────────────────┼──────────────────────────────────────┘
                                        ▼
                           Supabase Cloud PostgreSQL
```

### Dockerfiles Design

#### 1. Backend Dockerfile (`app/backend/Dockerfile`)
- **Stage 1 (`deps`)**: Uses `node:20-alpine`, copies `package*.json`, runs `npm ci --omit=dev` and cleans npm cache.
- **Stage 2 (`runner`)**: Minimal production image copying only necessary `node_modules` and `src` files.
- **Security**: Runs under unprivileged user `taskapp` (UID 1001) in group `nodejs` (GID 1001).
- **Healthcheck**: Periodically runs native Node.js fetch against `http://127.0.0.1:3000/health`.

#### 2. Frontend Dockerfile (`app/frontend/Dockerfile`)
- **Stage 1 (`build`)**: Uses `node:20-alpine`, runs `npm ci`, sets build arguments (`VITE_API_URL`), and compiles the Vite application (`npm run build`) into `dist/`.
- **Stage 2 (`production`)**: Uses `nginx:1.27-alpine`, copies production assets into `/usr/share/nginx/html`, and applies custom `nginx.conf`.
- **Security**: Runs unprivileged as `nginx` user with correct file permissions on `/var/cache/nginx`, `/var/log/nginx`, and pid file.
- **Healthcheck**: Uses BusyBox `wget --spider -q http://127.0.0.1/`.

#### 3. Frontend-to-Backend Reverse Proxy (`app/frontend/nginx.conf`)
- Serves SPA routing using `try_files $uri $uri/ /index.html;`.
- Proxies `/api/` requests to `http://backend:3000;` using Docker service DNS.
- Proxies `/health` to `http://backend:3000;`.
- Avoids CORS issues and ensures the browser can connect using clean relative paths (`/api/...`).

### Root Docker Compose (`docker-compose.yml`)
- **Services**:
  - `backend`: Container name `taskmanager-backend`, ports `3000:3000`, network alias `backend` and `backend-service`, healthcheck on `/health`.
  - `frontend`: Container name `taskmanager-frontend`, ports `8080:80`, depends on `backend` with `condition: service_healthy`.
- **Network**: Dedicated bridge network `taskmanager-network`.
- **Database**: Cloud-managed PostgreSQL on Supabase (`DATABASE_URL` via `app/backend/.env`), eliminating the need for an unnecessary local database container.

### Useful Docker Commands
```bash
# Build and start all services in detached mode
docker compose up -d --build

# View container status and health
docker compose ps

# View container logs
docker compose logs -f

# Stop and remove containers
docker compose down
```

---

## 4. Kubernetes (K8s): Production Orchestration

### Why do we need Kubernetes if we already have Docker?
Docker runs containers, but it **does not**:
- Automatically restart crashed containers across multiple servers.
- Automatically scale up pods when traffic spikes.
- Perform zero-downtime rolling updates.
- Distribute network traffic evenly across replicas.

Kubernetes does all of this.

### The Core Kubernetes Objects Explained

```
Namespace: task-manager
 ├── ConfigMap: task-manager-config (PORT, NODE_ENV, CORS, LOG_LEVEL)
 ├── Secret:    task-manager-secret (DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD)
 ├── Storage:   task-manager-pv & task-manager-pvc (1Gi persistent volume mounted at /app/logs)
 │
 ├── Frontend Service (LoadBalancer -> localhost:80)
 │    └── Frontend Deployment (2 Replicas: Nginx + Vite React)
 │         └── Reverse-proxies /api/* and /health ──┐
 │                                                  ▼
 └── Backend Service (ClusterIP: internal port 3000 -> backend-service:3000)
      └── Backend Deployment (2 Replicas: Node.js 20 Express)
           ├── Mounts task-manager-pvc at /app/logs
           └── Connects to Supabase Cloud PostgreSQL
```

| Kubernetes Manifest | Plain-English Explanation |
| :--- | :--- |
| **`namespace.yaml`** | Creates an isolated virtual workspace named `task-manager` so our app doesn't collide with other apps. |
| **`configmap.yaml`** | Stores non-sensitive settings (like `NODE_ENV=production`, `PORT=3000`, `CORS_ORIGIN`). |
| **`secret.yaml`** | Stores sensitive credentials (like `DATABASE_URL` and `JWT_SECRET`). Keeps secrets out of GitHub. |
| **`task-manager-pv.yaml` & `task-manager-pvc.yaml`** | **Persistent Storage**: Allocates a 1Gi `hostPath` PersistentVolume and claim mounted to `/app/logs` on backend pods for persistent audit logs and attachments, avoiding redundant local DBs while using cloud Supabase PostgreSQL. |
| **`backend-deployment.yaml`** | Runs 2 copies (replicas) of the backend API (`taskmanager-backend:v1.0.0`), with readiness/liveness probes and volume mount. |
| **`backend-service.yaml`** | Stable internal address (`backend-service:3000`) so frontend and internal consumers communicate via cluster DNS. |
| **`frontend-deployment.yaml`** | Runs 2 copies of the React/Nginx frontend (`taskmanager-frontend:v1.0.1`), configured to proxy `/api/` to `backend-service:3000`. |
| **`frontend-service.yaml`** | Exposes the frontend to the outside world (`LoadBalancer`), mapping port `80` to `http://localhost`. |
| **`ingress.yaml`** | HTTP router directing `/api` to the backend service and `/` to the frontend service (`task-manager.local`). |
| **`rbac.yaml`** | **Role-Based Access Control**: Grants a service account (`task-manager-operator`) restricted permissions without giving full administrator access. |

### Advanced Kubernetes Concepts Implemented
1. **Health Checks (Probes)**:
   - **Readiness Probe**: Kubernetes checks `GET /health` on port 3000. If the database is disconnected, traffic stops routing to that pod until it recovers.
   - **Liveness Probe**: Kubernetes checks `GET /` on port 3000. If the server process freezes, Kubernetes restarts the pod automatically.
2. **Non-Root Security Context**:
   - Backend runs as UID `1001` (`taskapp`).
   - Frontend runs as UID `101` (`nginx`).
   - Drops all capabilities (`drop: [ALL]`) to prevent container breakout.
3. **Seamless Frontend-to-Backend Reverse Proxy**:
   - Inside Nginx, all `/api/*` and `/health` requests are forwarded to `http://backend-service:3000`.
   - Result: No CORS errors, identical behavior across local and cluster environments.

### Phase 4 Required Operations Demonstrations

#### 1. Scaling Operation
```bash
# Scale backend deployment up to 4 replicas
kubectl scale deployment/backend --replicas=4 -n task-manager
kubectl rollout status deployment/backend -n task-manager
# Result: deployment "backend" successfully rolled out (4/4 ready)

# Restore backend deployment to 2 replicas
kubectl scale deployment/backend --replicas=2 -n task-manager
kubectl rollout status deployment/backend -n task-manager
# Result: deployment "backend" successfully rolled out (2/2 ready)
```

#### 2. Rolling Update Operation
```bash
# Update backend image to v1.0.1 with rolling update strategy (maxSurge: 1, maxUnavailable: 0)
kubectl set image deployment/backend backend=taskmanager-backend:v1.0.1 -n task-manager
kubectl rollout status deployment/backend -n task-manager
# Result: 1 out of 2 new replicas updated -> old replicas terminated -> deployment "backend" successfully rolled out
```

#### 3. Rollback Operation
```bash
# Inspect rollout history
kubectl rollout history deployment/backend -n task-manager

# Undo the last rollout to restore the previous revision (v1.0.0)
kubectl rollout undo deployment/backend -n task-manager
kubectl rollout status deployment/backend -n task-manager
# Result: deployment.apps/backend rolled back -> deployment "backend" successfully rolled out (restored to taskmanager-backend:v1.0.0)
```

---

## 5. CI/CD Pipeline with Jenkins

### What is Jenkins?
Jenkins is an automation server. Instead of a developer manually building Docker images, testing code, and typing `kubectl` commands, Jenkins executes these steps automatically inside a **Pipeline**.

### The 9 Pipeline Stages in `Jenkinsfile`

```
[1. Checkout] ➔ [2. Backend Valid.] ➔ [3. Frontend Valid.] ➔ [4. Docker Build] ➔ [5. Trivy Scan]
                                                                                     │
[9. Cleanup]  ⬅  [8. Smoke Tests]   ⬅  [7. K8s Deploy]     ⬅  [6. GHCR Push]   ⬅────┘
```

1. **Stage 1: Checkout**: Pulls the latest code from the `develop` branch on GitHub.
2. **Stage 2: Backend Validation**: Installs dependencies with `npm ci` and tests JavaScript syntax (`node --check`).
3. **Stage 3: Frontend Validation**: Installs dependencies and runs `npm run build` with Vite.
4. **Stage 4: Docker Build**: Builds both backend and frontend images with immutable version tags (`${BUILD_NUMBER}-${GIT_COMMIT_SHORT}`).
5. **Stage 5: Security Scanning (Trivy)**: Scans container images for security vulnerabilities before they leave the build machine.
6. **Stage 6: GHCR Publishing**: Securely logs into **GitHub Container Registry (`ghcr.io`)** using Jenkins credentials and pushes the images.
7. **Stage 7: Kubernetes Deployment**: Updates the live Kubernetes deployment with `kubectl set image` and verifies the rollout succeeded.
8. **Stage 8: Smoke Testing**: Runs tests against `/health` and `/` to prove the live application is responding.
9. **Stage 9: Cleanup & Post-Build**: Cleans up credentials, removes temporary files, and prints a formatted status summary.

### Jenkins on Docker Desktop (Windows)
We built a tailored Jenkins environment (`jenkins/`):
- **Docker-outside-of-Docker (DooD)**: Mounts `/var/run/docker.sock` so Jenkins can run Docker commands on your Windows host.
- **Port 8085**: Runs Jenkins on `http://localhost:8085` to prevent conflicts with the frontend on port `8080`.
- **Pre-installed tools**: Docker CLI, `kubectl`, Node.js 20, and Trivy are pre-baked into the image.

---

## 6. Security & Vulnerability Management

1. **Secret Masking**: Real secrets (`DATABASE_URL`, `JWT_SECRET`) are never committed to GitHub. They are managed through Kubernetes Secrets and Jenkins Credentials Binding.
2. **Trivy Image Scanning**: Integrated into Stage 5 of the pipeline to detect Common Vulnerabilities and Exposures (CVEs) in base images and packages.
3. **Least Privilege RBAC**: The Kubernetes ServiceAccount is limited only to the `task-manager` namespace.

---

## 7. Hands-On DevOps Operations & Cheat Sheet

### 1. Run with Docker Compose (Local Dev)
```powershell
# Start both containers:
docker compose up -d

# Check running containers:
docker compose ps

# View logs:
docker compose logs -f
```

### 2. Deploy to Kubernetes (One-Click)
```powershell
powershell -ExecutionPolicy Bypass -File .\k8s\deploy.ps1
```

### 3. Key Kubernetes Commands for Capstone Demonstration
```bash
# Check all resources in the namespace:
kubectl get all -n task-manager

# 1. Scaling: Scale backend from 2 to 3 replicas:
kubectl scale deployment/backend --replicas=3 -n task-manager
kubectl rollout status deployment/backend -n task-manager

# 2. Rolling Update: Update to a new version without downtime:
kubectl set image deployment/backend backend=task-manager-devops-backend:v1.0.1 -n task-manager
kubectl rollout status deployment/backend -n task-manager

# 3. Rollback: Instantly undo a deployment:
kubectl rollout undo deployment/backend -n task-manager
kubectl rollout history deployment/backend -n task-manager

# 4. Storage: Verify PV and PVC are bound:
kubectl get pv,pvc -n task-manager

# 5. RBAC: Verify restricted permissions:
kubectl auth can-i create deployments --as=system:serviceaccount:task-manager:task-manager-operator -n task-manager
# (Returns: yes)
kubectl auth can-i create nodes --as=system:serviceaccount:task-manager:task-manager-operator -n task-manager
# (Returns: no - cluster-level operations blocked)
```

### 4. Start Jenkins on Windows
```powershell
powershell -ExecutionPolicy Bypass -File .\jenkins\setup-jenkins.ps1
```
- Open **`http://localhost:8085`**
- Enter the admin password displayed in the console.

---

## 8. Summary of What We Achieved

| Area | What Was Accomplished |
| :--- | :--- |
| **Monorepo** | Node.js Express backend + React 18 Vite frontend + PostgreSQL database on Supabase. |
| **Docker** | Secure multi-stage, non-root Dockerfiles for both services + `docker-compose.yml`. |
| **Kubernetes** | Complete manifests in `k8s/` (Namespace, ConfigMap, Secret, Deployments, Services, PV/PVC, Ingress, RBAC). |
| **CI/CD** | Production 5-stage declarative `Jenkinsfile` with automated build, test, packaging, and SCM push trigger. |
| **Automation** | One-click PowerShell deployment scripts for Kubernetes (`deploy.ps1`) and Jenkins (`setup-jenkins.ps1`). |
| **Git & Versioning**| Clean, sanitized repository pushed to GitHub on branch **`develop`** without secret leaks. |
