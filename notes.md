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
7. [Ansible Automation & Configuration Management (Phase 5)](#7-ansible-automation--configuration-management-phase-5)
8. [Hands-On DevOps Operations & Cheat Sheet](#8-hands-on-devops-operations--cheat-sheet)

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
| **`task-manager-pv.yaml` & `task-manager-pvc.yaml`** | **Persistent Storage (Academic Demonstration)**: Allocates a 1Gi `hostPath` PersistentVolume and claim mounted to `/app/logs` on backend pods to demonstrate persistent volume claims without running an unneeded, duplicate local database. |
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

### 4. Persistent Storage Architecture & Verification

#### Application Storage Audit
- **Application Logging**: The backend uses Pino (`app/backend/src/logger.js`) and outputs all structured logs directly to `process.stdout` (standard 12-factor container design). It does **not** write log files to `/app/logs`.
- **Features**: The application does not implement file attachments or file-based audit records; all state is managed inside the cloud-hosted Supabase PostgreSQL database.
- **PV / PVC Purpose**: `task-manager-pv` and `task-manager-pvc` mount a 1Gi volume at `/app/logs` to demonstrate Kubernetes stateful storage without running a redundant local database.

#### Volume Permissions for Non-Root UID 1001
- By default, Kubernetes `hostPath` volumes mount with `root:root` ownership (mode `0755`), preventing non-root containers (like `taskapp`, UID 1001) from writing.
- Furthermore, `fsGroup` is not honored by Kubernetes for `hostPath` volume types.
- **Resolution**: An `initContainer` (`init-storage-permissions`) using the cached backend image runs before the app starts to execute `chown -R 1001:1001 /app/logs && chmod -R 775 /app/logs`. This grants write access to UID 1001 while keeping the application container non-root (`runAsNonRoot: true`).

#### Node-Local Limitations of `hostPath`
> [!IMPORTANT]
> **Node-Local Limitation**: `hostPath` volumes bind to a specific directory on the host node (`/run/desktop/mnt/host/c/...`). While data persists across pod restarts and crashes on the **same node**, `hostPath` does **not** persist data if a pod is rescheduled to a different node in a multi-node cluster, nor does it protect against node failure. For multi-node production clusters, a network-attached storage provisioner (such as AWS EBS, Azure Disk, NFS, or Ceph) is required.

#### Persistence Test Across Pod Deletion
1. **Write from Pod A**: Wrote test file `/app/logs/persistence-verification.txt` from pod `backend-84498dc6cf-85vjm`.
2. **Read from Pod B**: Read identical content from second replica `backend-84498dc6cf-rfdtx`, confirming multi-pod read access on the single-node mount.
3. **Delete Pod A**: Terminated pod `backend-84498dc6cf-85vjm`. Kubernetes started replacement pod `backend-84498dc6cf-krdgd`.
4. **Verification**: Replacement pod read `/app/logs/persistence-verification.txt` successfully via `task-manager-pvc`.
5. **Clean up**: Removed the temporary verification file.

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

## 7. Ansible Automation & Configuration Management (Phase 5)

### Why Ansible?
Ansible enables **Infrastructure as Code (IaC)** and automated configuration management without installing client agents on managed nodes. In our monorepo, Ansible automates:
1. Docker Engine provisioning on Linux hosts (`install_docker.yml`).
2. Kubernetes node setup via kubeadm (`install_kubernetes.yml`).
3. Declarative application deployment across Kubernetes (`deploy_application.yml`).
4. Safe non-sensitive configuration management via ConfigMaps (`configure_application.yml`).

### WSL2 Control Machine Architecture
Ansible runs directly inside **Ubuntu on WSL2** on the Windows 11 host:
- **Ansible Core**: `2.20.1` running Python `3.14`.
- **Integrated Docker**: WSL2 communicates directly with Docker Desktop's engine via named pipes/socket.
- **Integrated Kubernetes**: WSL2 communicates directly with `desktop-control-plane` using `kubectl --context=docker-desktop`.

### Playbook Inventory and Purposes

```text
ansible/
├── ansible.cfg                # Configures inventory, default callbacks, disabled host key checks
├── requirements.yml           # Required collections (ansible.posix, community.general)
├── inventory/
│   ├── hosts.ini              # Host definitions (local, docker_nodes, k8s_nodes)
│   └── group_vars/
│       └── all.yml            # Non-sensitive variables, ports, and package lists
└── playbooks/
    ├── install_docker.yml         # Installs Docker CE & Compose plugin on Ubuntu Linux hosts
    ├── install_kubernetes.yml     # Provisions kubeadm, containerd, and kubelet on Linux nodes
    ├── deploy_application.yml     # Orchestrates k8s/ manifests in dependency order on cluster
    └── configure_application.yml  # Safely manages task-manager-config without exposing secrets
```

### Distinction Between Environments
- **`install_docker.yml` & `install_kubernetes.yml`**: Designed, syntax-verified (`--syntax-check`), and preflight-guarded for conventional bare-metal or cloud Ubuntu Linux virtual machines. Features include idempotent containerd setup with enforced `SystemdCgroup = true`, pinned Kubernetes `v1.31` packages (`1.31.0-1.1`), predictable `/root/.kube/config` paths, and in-memory join token distribution. Both contain safety guards when run under WSL2 to avoid corrupting or resetting the host's existing Docker Desktop engine and Kubernetes cluster. They were not executed on live servers as no remote Linux targets were provisioned.
- **`deploy_application.yml` & `configure_application.yml`**: Operationally executed and verified against the active Docker Desktop Kubernetes cluster (`docker-desktop`), managing live deployments, rollouts, and ConfigMaps safely with conditional rollout restarts. Strict secret protection ensures placeholder credentials from `k8s/secret.yaml` are never automatically applied, failures occur if the Secret is missing, and secret data is never exposed in output.

### Key Ansible Commands
```bash
# Install collections from Ubuntu WSL2:
ansible-galaxy collection install -r requirements.yml

# Validate playbook syntax from Ubuntu WSL2:
export ANSIBLE_CONFIG=ansible.cfg
ansible-playbook -i inventory/hosts.ini --syntax-check playbooks/install_docker.yml
ansible-playbook -i inventory/hosts.ini --syntax-check playbooks/install_kubernetes.yml
ansible-playbook -i inventory/hosts.ini --syntax-check playbooks/deploy_application.yml
ansible-playbook -i inventory/hosts.ini --syntax-check playbooks/configure_application.yml

# Run Configuration Management:
ansible-playbook -i inventory/hosts.ini playbooks/configure_application.yml

# Run Application Deployment:
ansible-playbook -i inventory/hosts.ini playbooks/deploy_application.yml

# Dry-run check mode:
ansible-playbook -i inventory/hosts.ini --check playbooks/configure_application.yml
```

---

## 8. Terraform Infrastructure as Code (Phase 6)

### Why Terraform?
Terraform provides **declarative, reproducible Infrastructure as Code (IaC)**. While Ansible focuses on procedural tasks and configuration management, Terraform manages the complete lifecycle of cloud and container resources via declared state files (`.tfstate`), dependency graphs, and reusable modules.

### Provider & Architecture in Local Docker Desktop
- **Provider**: `kreuzwerker/docker` pinned to version `~> 3.0.2` (Terraform `>= 1.5.0`).
- **Isolation Strategy**:
  - **Docker Compose** runs the development stack on ports `3000` & `8080`.
  - **Kubernetes** orchestrates the production application on port `80` (`LoadBalancer`).
  - **Terraform** provisions an alternative, isolated container stack on host ports `3001` (backend) and `8088` (frontend) via a custom bridge network (`taskmanager-tf-network`) and persistent log volume (`taskmanager-tf-logs`).
- **Demonstration Storage**: The `taskmanager-tf-logs` volume is mounted at `/app/logs` as a persistent volume demonstration. The Node.js Express backend logs directly to standard output via **Pino**, adhering to Twelve-Factor app principles.

### Directory Structure & Reusable Module
```text
terraform/
├── .gitignore                      # Protects .terraform/, *.tfstate, and *.tfvars
├── README.md                       # Comprehensive operations guide
├── main.tf                         # Root configuration, network, volume, module calls
├── variables.tf                    # Parameterized variables (ports, images, sensitive credentials)
├── outputs.tf                      # Useful endpoints and container IDs (secrets omitted)
├── terraform.tfvars.example        # Sanitized template with placeholder secrets
└── modules/
    └── docker_container/           # Reusable container module
        ├── main.tf                 # docker_container resource definition
        ├── variables.tf            # Module input parameters
        └── outputs.tf              # Container ID, name, published ports
```

### State-File Security Limitations
- `sensitive = true` masks values in CLI output (`terraform plan`/`apply`), preventing visual exposure in terminal logs.
- **It does NOT encrypt secrets in Terraform state (`.tfstate`)!** Attributes like `DATABASE_URL` and `JWT_SECRET` are stored as cleartext JSON inside `.tfstate`.
- Local state files are strictly excluded from Git via `.gitignore`, should reside on full-disk encrypted filesystems (BitLocker / LUKS), and require encrypted remote backends (e.g. AWS S3 + KMS, Terraform Cloud) in team environments.
- The `jwt_secret` variable has no insecure default and requires explicit configuration.

### Relationship with the DevOps Stack
- **Docker Compose**: Rapid local developer workflow (`3000`, `8080`).
- **Kubernetes**: Multi-replica, self-healing, rolling production deployments (`80`).
- **Ansible**: In-cluster ConfigMap management, dynamic conditional rollout triggers, and node bootstrapping.
- **Terraform**: Declarative resource lifecycle management, modular abstractions, and isolated environments (`3001`, `8088`).

### Key Terraform Commands
```bash
cd terraform

# 1. Format check and validate configuration:
terraform fmt -check
terraform init
terraform validate

# 2. Plan changes:
terraform plan

# 3. Apply infrastructure:
terraform apply -auto-approve

# 4. Verify endpoints:
curl http://localhost:8088/
curl http://localhost:3001/health

# 5. Clean teardown:
terraform destroy -auto-approve
```

---

## 9. Monitoring with Prometheus and Grafana (Phase 7)

### Why Prometheus & Grafana?
Observability is critical in production DevOps environments. Phase 7 implements automated metric scraping, alerting capabilities, and real-time visualization:
- **Prometheus**: Pulls time-series metrics every 10–15s from application endpoints and Kubernetes cluster infrastructure.
- **kube-state-metrics**: Collects in-cluster object health, pod lifecycle state, and readiness metrics directly from the Kubernetes API.
- **Grafana**: Visualizes metrics across 8 real-time operational panels.
- **Metrics Server & cAdvisor**: Captures real-time CPU and memory usage across nodes, pods, and containers.

### Architecture & Isolation
- **Namespace**: Dedicated `monitoring` namespace isolating monitoring infrastructure from application workloads.
- **Backend Application Metrics**: Prometheus scrapes `backend-service.task-manager.svc.cluster.local:3000/metrics` capturing `http_requests_total`, `http_request_duration_seconds`, and Node.js process metrics (`process_cpu_seconds_total`, `process_resident_memory_bytes`, `nodejs_heap_size_used_bytes`).
- **Pod Readiness Metrics**: `kube-state-metrics` (v2.12.0) runs under non-root UID 65534 with a minimal ClusterRole granting read access strictly to `pods` and `namespaces`. Scraped at `kube-state-metrics.monitoring.svc.cluster.local:8080/metrics`.
- **Cluster & Container Metrics**: Kubelet cAdvisor scrapes provide `container_cpu_usage_seconds_total` and `container_memory_working_set_bytes`.
- **Metrics Server**: Configured with `--kubelet-insecure-tls` for Docker Desktop, enabling `kubectl top nodes` and `kubectl top pods`.
- **Security & Zero Leaked Secrets**:
  - `monitoring/grafana/secret.yaml` was completely removed from version control.
  - The deployment script (`monitoring/deploy.ps1`) enforces `$env:GRAFANA_ADMIN_PASSWORD` and halts immediately if unset or empty.
  - The Secret (`grafana-secret`) is generated and applied dynamically at deploy-time via `kubectl create secret generic ... --dry-run=client -o yaml` without printing credentials.
  - Both Prometheus (`UID 65534`), kube-state-metrics (`UID 65534`), and Grafana (`UID 472`) run as non-root containers with strict resource requests and limits. No public LoadBalancers are exposed; access is mediated through `kubectl port-forward`.

```text
monitoring/
├── README.md                          # Full operations guide
├── namespace.yaml                     # monitoring namespace
├── metrics-server.yaml                # Metrics Server for kubectl top
├── deploy.ps1                         # Deployment script requiring $env:GRAFANA_ADMIN_PASSWORD
├── dashboards/
│   └── dashboard-task-manager.json    # Standalone Grafana Dashboard JSON definition
├── kube-state-metrics/
│   ├── rbac.yaml                      # ServiceAccount & ClusterRole (pods/namespaces read)
│   ├── deployment.yaml                # kube-state-metrics Deployment (v2.12.0, non-root)
│   └── service.yaml                   # ClusterIP Service (8080)
├── prometheus/
│   ├── rbac.yaml                      # ServiceAccount & ClusterRole
│   ├── configmap.yaml                 # Scrape configuration (backend, cAdvisor, ksm, prom)
│   ├── deployment.yaml                # Prometheus Deployment
│   └── service.yaml                   # ClusterIP Service (9090)
└── grafana/
    ├── configmap-datasources.yaml     # Auto-provisioned Prometheus datasource
    ├── configmap-dashboards.yaml      # Dashboard provider
    ├── configmap-dashboard-json.yaml  # ConfigMap wrapping dashboard JSON
    ├── deployment.yaml                # Grafana Deployment (3000)
    └── service.yaml                   # ClusterIP Service
```

### Accessing Dashboards
```bash
# Grafana (Host Port 3001 -> Container Port 3000):
kubectl port-forward svc/grafana-service 3001:3000 -n monitoring
# URL: http://localhost:3001 (User: admin / Password: configured in $env:GRAFANA_ADMIN_PASSWORD)

# Prometheus (Host Port 9090 -> Container Port 9090):
kubectl port-forward svc/prometheus-service 9090:9090 -n monitoring
# URL: http://localhost:9090
```

---

## 10. Hands-On DevOps Operations & Cheat Sheet

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

## 11. Summary of What We Achieved

| Area | What Was Accomplished |
| :--- | :--- |
| **Monorepo** | Node.js Express backend + React 18 Vite frontend + PostgreSQL database on Supabase. |
| **Docker** | Secure multi-stage, non-root Dockerfiles for both services + `docker-compose.yml`. |
| **Kubernetes** | Complete manifests in `k8s/` (Namespace, ConfigMap, Secret, Deployments, Services, PV/PVC, Ingress, RBAC). |
| **CI/CD** | Production 5-stage declarative `Jenkinsfile` with automated build, test, packaging, and SCM push trigger. |
| **Ansible Automation** | 4 production playbooks for Docker, Kubernetes, Application Deployment, and Config Management running from WSL2. |
| **Terraform IaC** | Modular Infrastructure as Code (`kreuzwerker/docker` ~> 3.0.2) with reusable container module, outputs, and isolated stack. |
| **Monitoring (Prometheus & Grafana)** | Complete monitoring stack with auto-provisioned Prometheus, Grafana 8-panel dashboard, Metrics Server, and cAdvisor. |
| **Centralized Logging (Fluentd)** | Lightweight Fluentd DaemonSet collecting application (Pino JSON), container, and Kubernetes logs with metadata enrichment. |
| **Automation** | One-click PowerShell deployment scripts for Kubernetes (`deploy.ps1`), Jenkins (`setup-jenkins.ps1`), Monitoring (`deploy.ps1`), and Logging (`deploy.ps1`). |
| **Git & Versioning**| Clean, sanitized repository pushed to GitHub on branch **`develop`** without secret leaks. |

---

## 12. Centralized Logging with Fluentd (Phase 8)

### Logging Architecture
Phase 8 implements lightweight centralized log collection on Docker Desktop Kubernetes using a **Fluentd DaemonSet** (`fluent/fluentd-kubernetes-daemonset:v1.17-debian-forward-1`) deployed in the isolated `logging` namespace:
- **Log Collection Sources**: Tails container `stdout`/`stderr` logs from `/var/log/containers/*.log` (which resolve to `/var/log/pods/...` under containerd CRI format), while explicitly excluding Fluentd's own logs (`exclude_path`) to prevent recursive loops.
- **Metadata Enrichment & Secret Scope**: Uses `fluent-plugin-kubernetes_metadata_filter` with a read-only ServiceAccount (`pods`, `namespaces` only—no Kubernetes API permissions to read `secrets`) to attach `namespace_name`, `pod_name`, `container_name`, and pod/namespace labels. Fluentd does not directly inspect container environment variables; however, because it collects `stdout`/`stderr`, any secret accidentally printed by an application to stdout/stderr can still be collected. Applications must avoid logging sensitive values.
- **JSON Parsing & Separation**:
  - **Application Logs (`task-manager` namespace)**: Parses structured Pino JSON logs (`@type parser` with `reserve_time true`) while gracefully preserving plain-text Nginx logs from `frontend`. Tagged with `log_category: "application"`.
  - **Infrastructure Logs (other namespaces)**: `kube-system`, `monitoring`, and control-plane logs are tagged with `log_category: "infrastructure"`.

### Fluentd Components (`logging/`)
```text
logging/
├── README.md          # Full operations, storage, and verification manual
├── namespace.yaml     # Dedicated 'logging' namespace
├── rbac.yaml          # ServiceAccount + read-only ClusterRole (pods, namespaces)
├── configmap.yaml     # Fluentd fluent.conf pipeline definition
├── daemonset.yaml     # Fluentd DaemonSet (resource limits, tolerations, hostPath mounts)
└── deploy.ps1         # One-click Windows PowerShell deployment script
```

### Storage, Retention & Limitations
- **Centralized Local Storage**: Logs are written as daily time-sliced JSON files (`timekey 1d`, `flush_interval 5s`) to `/var/log/fluentd-central/` backed by a node `hostPath` volume:
  - Application logs: `/var/log/fluentd-central/application/app.YYYYMMDD.log`
  - Infrastructure logs: `/var/log/fluentd-central/infrastructure/infra.YYYYMMDD.log`
- **Retention**: Files flush every 5 seconds into daily files; no automatic age-based purging is configured.
- **Persistence & Limitations**:
  - Previously flushed log files written to `/var/log/fluentd-central` (`hostPath`) persist across Fluentd pod restarts on the same node.
  - However, Fluentd's position file (`pos_file`) and file buffers (`/fluentd/state`) are stored in `emptyDir` and are lost when the Fluentd pod is recreated. This can cause log re-reading/duplicates or loss of buffered, unflushed records; this setup does not provide exactly-once collection or guaranteed delivery.
  - Because `hostPath` is node-local to Docker Desktop (`desktop-control-plane`), logs do not replicate across multi-node clusters and are lost if the cluster/VM is reset.
  - `/var/log/pods` on Docker Desktop is `0750` owned by `root:root`, so Fluentd runs with `allowPrivilegeEscalation: false` and UID `0` to read host CRI logs; no LoadBalancer or NodePort is exposed.

### Deployment & Verification Commands
```powershell
# Deploy Fluentd logging stack
powershell -ExecutionPolicy Bypass -File .\logging\deploy.ps1

# Check DaemonSet and Pod health
kubectl get ds,pods,svc -n logging

# Validate Fluentd configuration syntax
kubectl exec -n logging ds/fluentd -- fluentd --dry-run -c /fluentd/etc/fluent.conf

# Inspect collected application and infrastructure logs
kubectl exec -n logging ds/fluentd -- sh -c "grep 'request completed' /var/log/fluentd-central/application/app.20261125.log | tail -n 2"
kubectl exec -n logging ds/fluentd -- sh -c "grep 'kube-system' /var/log/fluentd-central/infrastructure/infra.20261125.log | tail -n 2"
```

---

## 13. Security Implementation — DevSecOps (Phase 9)

### Security Architecture
Phase 9 integrates automated static analysis, container vulnerability scanning, secret segregation, hardened Docker builds, and least-privilege Kubernetes RBAC into the existing DevOps pipeline without redesigning earlier phases:
- **SonarQube Community Build (`security/docker-compose.sonarqube.yml`)**: Pinned `sonarqube:25.12.0.117093-community` bound to `127.0.0.1:9000` with persistent named volumes and embedded H2 database. Project metadata and exclusions are defined in `sonar-project.properties`.
- **Jenkins Credentials**: `sonarqube-token` is stored encrypted in Jenkins Credentials and injected via `withCredentials` (`SONAR_TOKEN`), masked in build logs. Jenkins communicates with SonarQube via `http://host.docker.internal:9000`.
- **Docker Image Hardening & Trivy Scanning**:
  - Pinned base images (`node:20.20.2-alpine3.23`, `nginx:1.27.5-alpine`) with `apk upgrade --no-cache`.
  - Backend runtime removes unnecessary `npm`/`corepack` build tools and excludes `package-lock.json`; `drizzle-orm` upgraded to `^0.45.2` to remediate `CVE-2026-39356`.
  - Jenkins Stages 7 and 8 run `trivy image --exit-code 1 --scanners vuln --severity HIGH,CRITICAL` on both freshly built images.
- **Kubernetes Secret & RBAC Hardening**:
  - `k8s/deploy.ps1` requires `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `app/backend/.env` (with no hardcoded administrator defaults) and fails safely if `task-manager-secret` is missing and any required key is absent or empty.
  - `k8s/rbac.yaml` defines `task-manager-operator` strictly as an explicitly provisioned RBAC demonstration account (not used by any application pod or deployment script), narrowed to read-only (`pods`, `pods/log`, `services`) plus namespace-scoped `deployments` management, with zero `secrets` access.
  - `k8s/backend-deployment.yaml` and `k8s/frontend-deployment.yaml` set `automountServiceAccountToken: false` so application pods receive zero Kubernetes API access.
  - Monitoring and Fluentd ServiceAccounts retain read-only, least-privilege permissions with no Secret access.

### Verification & Limitations
```powershell
# Start SonarQube locally
docker compose -f security/docker-compose.sonarqube.yml up -d
curl.exe -s http://localhost:9000/api/system/status

# Verify RBAC boundaries
kubectl auth can-i get secrets --as=system:serviceaccount:task-manager:task-manager-operator -n task-manager
kubectl auth can-i get pods --as=system:serviceaccount:task-manager:default -n task-manager
```
- **Limitations**: Local Docker Desktop single-node environment is not production-grade (SonarQube uses embedded H2, Jenkins mounts `/var/run/docker.sock`, and Kubernetes lacks an external KMS or enforced NetworkPolicies). See `security/README.md` for full details.

---

## 14. Blue-Green Deployment Strategy (Phase 10)

### Architecture & Traffic Switching
Phase 10 implements zero-downtime **Blue-Green Deployment** on Kubernetes (`task-manager` namespace) using separate `blue` (`backend-blue`, `frontend-blue` on `v1.0.0` / `v1.0.1`) and `green` (`backend-green`, `frontend-green` on `v2.0.0-green`) Deployments:
- **Service Selector Routing & Safe Redeployment**: `k8s/backend-service.yaml` (`ClusterIP :3000`) and `k8s/frontend-service.yaml` (`LoadBalancer :80`) default to `version: blue` so legacy unversioned deployments cannot accidentally receive traffic. `k8s/deploy.ps1` preserves any active `version=blue|green` selector so rerunning standard deployment cannot reset an active Green environment.
- **Shared Infrastructure**: Blue and Green reuse `task-manager-config`, `task-manager-secret`, `task-manager-pvc`, and the Supabase PostgreSQL database without duplicating secrets or storage.
- **Controller Script (`k8s/blue-green.ps1`)**:
  - `status`: Displays Blue/Green pod readiness, images, and active Service selectors.
  - `deploy-blue` / `deploy-green`: Builds/deploys the environment and independently verifies Green (`/health` and `/`) via `kubectl port-forward` before any traffic switch.
  - `switch-green` / `rollback-blue`: Records previous selectors, enforces readiness gates, updates selectors with exit-code checks, verifies `EndpointSlices` converge exclusively to the target color, and validates `http://localhost/health` and `http://localhost/`. If any update or verification step fails, it automatically restores both previous selectors and reports rollback status.

### Shared Database & Environment Limitations
- **Database Compatibility**: Blue and Green share the same Supabase PostgreSQL instance. Never run concurrent migrations across Blue and Green; schema changes must remain backward-compatible during the cutover/rollback window.
- **Single-Node Docker Desktop**: `task-manager-pvc` (`ReadWriteOnce` `hostPath`) works across Blue and Green on single-node `desktop-control-plane`, whereas multi-node clusters cannot mount a single `RWO` block volume across different nodes.
- **Jenkins Integration**: `Jenkinsfile` remains CI-focused (`pollSCM`, SonarQube, Trivy, packaging) so every Git push does not automatically switch production traffic; Blue-Green cutover is intentionally operator-triggered via `k8s/blue-green.ps1`. See `k8s/BLUE-GREEN.md` for full details.

---

## 15. GitOps Implementation Using ArgoCD (Phase 11)

### GitOps Architecture & Responsibilities
Phase 11 implements declarative **GitOps Continuous Delivery** using **ArgoCD (`v3.6.1`)** installed in the dedicated `argocd` namespace:
- **Jenkins (CI)** remains responsible for Continuous Integration (`pollSCM`, automated tests, SonarQube static analysis, Docker builds, Trivy vulnerability scans, and artifact packaging) without automatically deploying or switching production traffic on push.
- **ArgoCD (CD)** continuously reconciles `gitops/` on branch `develop` of `https://github.com/Nik848/task-manager-devops` into namespace `task-manager` (`prune: true`, `selfHeal: true`, `RespectIgnoreDifferences=true`, `ServerSideApply=true`).

### Resource Ownership & Blue-Green Compatibility
- **Managed by ArgoCD (`gitops/manifests/`)**: `ConfigMap/task-manager-config`, RBAC (`task-manager-operator`, `task-manager-role`, `task-manager-rolebinding`), Blue & Green Deployments (`backend-blue`, `frontend-blue`, `backend-green`, `frontend-green`), and `Service` metadata/ports.
- **Protected Outside GitOps**: `Secret/task-manager-secret`, `PV/task-manager-pv`, and `PVC/task-manager-pvc` are intentionally excluded from `gitops/` so ArgoCD never overwrites credentials or prunes persistent storage.
- **Blue-Green Coexistence**: `gitops/application.yaml` ignores `/spec/selector` differences on `Service` resources (`ignoreDifferences` + `RespectIgnoreDifferences=true`), enabling `k8s/blue-green.ps1` to switch traffic between `blue` and `green` without ArgoCD self-heal resetting selectors.

### Key Operations & Security
```powershell
# Port-forward ArgoCD UI locally (no public LoadBalancer/NodePort)
kubectl port-forward svc/argocd-server -n argocd 8084:443

# Retrieve initial admin password securely (never commit to Git)
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}"

# Check Application status and trigger hard refresh
kubectl get application task-manager-gitops -n argocd
kubectl annotate application task-manager-gitops -n argocd argocd.argoproj.io/refresh=hard --overwrite
```
- **Limitations**: Docker Desktop has no Ingress controller installed, so `Ingress/task-manager-ingress` is excluded from `gitops/` to keep ArgoCD health `Healthy`. See `gitops/README.md` for full details.
