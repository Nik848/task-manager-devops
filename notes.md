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

## 3. Containerization with Docker

### Why Docker?
A container is a lightweight, isolated package containing everything the application needs to run:
- Code
- Node.js runtime
- Dependencies (`node_modules`)
- Configuration files

### `Dockerfile` vs. `docker-compose.yml`
- **`Dockerfile` = The Recipe**: Defines how to build a single container image.
  - **Backend Dockerfile**: Uses Node.js 20 Alpine, creates a secure non-root user (`appuser`), installs packages, and exposes port `3000`.
  - **Frontend Dockerfile**: Uses a **Multi-Stage Build**:
    - *Stage 1 (Build)*: Compiles React code into static HTML/JS/CSS using Node.
    - *Stage 2 (Production)*: Discards Node and copies the static files into a super-fast, tiny **Nginx web server** on port `80`.
- **`docker-compose.yml` = The Conductor**: Coordinates running both containers together on local computers:
  - Maps ports: `3000:3000` for backend, `8080:80` for frontend.
  - Sets up networking so containers can discover each other.
  - Manages environment variables.

### The CORS Problem We Solved
When your frontend (`http://localhost:8080`) communicates with your backend (`http://localhost:3000`), the browser checks **CORS (Cross-Origin Resource Sharing)**. We updated the backend to accept requests from both `8080` (Docker) and `5173` (Vite dev), allowing signups and logins to work seamlessly.

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
 ├── ConfigMap: task-manager-config (PORT, NODE_ENV, CORS)
 ├── Secret:    task-manager-secret (DATABASE_URL, JWT_SECRET)
 ├── Storage:   postgres-pv & postgres-pvc (Persistent disk claim)
 │
 ├── Frontend Service (LoadBalancer -> localhost:80)
 │    └── Frontend Deployment (2 Replicas: Nginx + React)
 │         └── Reverse-proxies /api/* ──┐
 │                                      ▼
 └── Backend Service (ClusterIP: internal port 3000)
      └── Backend Deployment (2 Replicas: Node.js Express)
           └── Connects to Supabase PostgreSQL
```

| Kubernetes Manifest | Plain-English Explanation |
| :--- | :--- |
| **`namespace.yaml`** | Creates an isolated virtual workspace named `task-manager` so our app doesn't collide with other apps. |
| **`configmap.yaml`** | Stores non-sensitive settings (like `NODE_ENV=production`, `PORT=3000`). |
| **`secret.yaml`** | Stores sensitive credentials (like `DATABASE_URL` and `JWT_SECRET`). Keeps secrets out of GitHub. |
| **`backend-deployment.yaml`** | Runs 2 copies (replicas) of the backend API. If one crashes, Kubernetes restarts it in seconds. |
| **`backend-service.yaml`** | A stable internal address (`backend-service:3000`) so other pods can talk to the backend even as pods restart and change IP addresses. |
| **`frontend-deployment.yaml`** | Runs 2 copies of the React/Nginx frontend. |
| **`frontend-service.yaml`** | Exposes the frontend to the outside world (`LoadBalancer`), mapping port `80` to `http://localhost`. |
| **`ingress.yaml`** | A smart HTTP router directing `/api` to the backend and `/` to the frontend. |
| **`postgres-pv.yaml` & `postgres-pvc.yaml`** | Persistent Volume & Claim demonstrating Kubernetes persistent disk storage for evaluation. |
| **`rbac.yaml`** | **Role-Based Access Control**: Grants a service account (`task-manager-operator`) restricted permissions without giving full administrator access. |

### Advanced Kubernetes Concepts Implemented
1. **Health Checks (Probes)**:
   - **Readiness Probe**: Kubernetes checks `GET /health`. If the database is disconnected, traffic stops routing to that pod until it recovers.
   - **Liveness Probe**: Kubernetes checks `GET /`. If the server process freezes, Kubernetes restarts the pod automatically.
2. **Non-Root Security Context**:
   - Backend runs as UID `1001` (`appuser`).
   - Frontend runs as UID `101` (`nginx`).
   - Prevents container breakout attacks.
3. **Seamless Frontend-to-Backend Reverse Proxy**:
   - Inside [app/frontend/nginx.conf](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/app/frontend/nginx.conf), Nginx intercepts `/api/*` and forwards it to `http://backend-service:3000`.
   - Result: No CORS errors, no hardcoded developer IP addresses, works anywhere.

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
