# Task Management System — DevOps Capstone Engineering Report
## Complete Implementation & Verification Report (Phases 1 through 7)

**Repository:** `https://github.com/Nik848/task-manager-devops`  
**Target Branch:** `develop`  
**Execution Environment:** Windows 11 Host, Docker Desktop (Single-Node Kubernetes `docker-desktop`), Ubuntu on WSL2  
**Database:** Cloud-Managed PostgreSQL (Supabase) via SSL Connection Pooler  
**Latest Verified Commit:** `5b7d4af` (`fix(monitoring): remove hardcoded password and add kube-state-metrics readiness`)  
**CI/CD Pipeline Status:** Jenkins Build #12 — **SUCCESS**

---

## Executive Summary

This document presents the complete engineering report and architectural documentation for the **Task Management System DevOps Capstone Project**. Across seven sequential development phases, a full-stack monorepo application was transitioned from local source code into a fully automated, containerized, orchestrated, configured, provisioned, and monitored cloud-native software system:

1. **Phase 1: Source Code Management & Branching Strategy** — Monorepo setup, Git branch model (`develop`, feature branches), peer-review guidelines (`CONTRIBUTING.md`), and issue tracking.
2. **Phase 2: Continuous Integration with Jenkins** — Containerized Jenkins running via Docker-outside-of-Docker (DooD), automated 5-stage declarative pipeline (`Jenkinsfile`), SCM polling triggers, and build artifact archiving.
3. **Phase 3: Docker Containerization & Multi-Container Compose** — Multi-stage non-root Dockerfiles for Express API and React SPA, production Nginx reverse proxy, and local multi-container orchestration with Docker Compose.
4. **Phase 4: Kubernetes Orchestration & Cluster Management** — Complete declarative manifests in `k8s/`, non-root security contexts, dual replicas, health probes, rolling updates, rollbacks, and persistent storage demonstrations.
5. **Phase 5: Configuration Management & Automation with Ansible** — Production Ansible playbooks executing from Ubuntu WSL2 for Docker engine installation, Kubernetes control-plane/worker bootstrapping, declarative application deployment, and idempotent ConfigMap configuration.
6. **Phase 6: Infrastructure as Code (IaC) with Terraform** — Declarative container infrastructure management using `kreuzwerker/docker` provider, modular architecture, parameterized variables, and security controls over state-file credential storage.
7. **Phase 7: Full-Stack Observability with Prometheus & Grafana** — Comprehensive metrics collection via Prometheus, `kube-state-metrics` for pod readiness, Kubelet cAdvisor for container CPU/RAM, Kubernetes Metrics Server, and a provisioned 8-panel Grafana dashboard with zero hardcoded credentials.

---

## Architecture Overview

```text
                                              DEVELOPER WORKFLOW
                                         ┌───────────────────────────┐
                                         │ Developer pushes to Git   │
                                         │ (branch: origin/develop)  │
                                         └─────────────┬─────────────┘
                                                       │
                                                       ▼
                                         ┌───────────────────────────┐
                                         │      Jenkins Server       │
                                         │  (Docker DooD, Port 8085) │
                                         │  • Lint & Code Quality    │
                                         │  • Unit/Integration Tests │
                                         │  • Build Docker Images    │
                                         │  • Archive Artifacts      │
                                         └─────────────┬─────────────┘
                                                       │
                           ┌───────────────────────────┴───────────────────────────┐
                           ▼                                                       ▼
                LOCAL COMPOSE WORKFLOW                                  KUBERNETES PRODUCTION
           ┌───────────────────────────────┐                       ┌───────────────────────────────┐
           │ docker compose up -d          │                       │ Namespace: task-manager       │
           │ • taskmanager-frontend (:8080)│                       │ • Frontend (2 replicas, :80)  │
           │ • taskmanager-backend (:3000) │                       │ • Backend (2 replicas, :3000) │
           └───────────────┬───────────────┘                       │ • PV/PVC Persistent Storage   │
                           │                                       └───────────────┬───────────────┘
                           │                                                       │
                           │                                                       ▼
                           │                                            MONITORING & OBSERVABILITY
                           │                                       ┌───────────────────────────────┐
                           │                                       │ Namespace: monitoring         │
                           │                                       │ • Prometheus (:9090)          │
                           │                                       │ • Grafana (:3000 -> :3001)    │
                           │                                       │ • kube-state-metrics (:8080)  │
                           │                                       │ • Metrics Server & cAdvisor   │
                           │                                       └───────────────┬───────────────┘
                           │                                                       │
                           ▼                                                       ▼
              ┌─────────────────────────────────────────────────────────────────────────┐
              │                   Cloud PostgreSQL Database (Supabase)                  │
              │                   SSL Connection Pooler (External DBaaS)                │
              └─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Source Code Management & Branching Strategy

### 1.1 Objectives
- Establish a clean, professional monorepo structure housing both backend and frontend codebases.
- Implement Git branching best practices adhering to the **GitFlow** model.
- Configure collaboration policies, contribution standards, and security procedures.

### 1.2 Implementation Details
- **Monorepo Directory Structure**:
  ```text
  task-manager-devops/
  ├── app/
  │   ├── backend/             # Node.js 20, Express, Drizzle ORM, Pino, Prom-client
  │   └── frontend/            # React 18, Vite, Tailwind CSS, Lucide icons
  ├── CONTRIBUTING.md          # Branch naming rules, PR review standards, commit guidelines
  ├── LICENSE                  # MIT open-source license
  └── README.md                # Repository overview and developer quickstart
  ```
- **Branching Workflow**:
  - `main`: Production-ready releases.
  - `develop`: Integration branch where all completed features converge.
  - `feature/*`: Dedicated branches for independent features (e.g., `feature/contribution-workflow`, `feature/code-review-policy`).
- **Code Review & Security Policies**:
  - Mandatory peer review prior to merging into `develop`.
  - Automated dependency vulnerability audits (`npm audit`).
  - Strict prohibition against committing `.env` files, production credentials, or private signing keys.

### 1.3 Verification & Status
- Merged feature branches into `develop` cleanly with resolved merge commits.
- Git commit logs maintain clear semantic messages (`feat:`, `fix:`, `docs:`, `ci:`).

---

## Phase 2: Continuous Integration with Jenkins

### 2.1 Objectives
- Run a reproducible, containerized Jenkins automation server on the Windows 11 host.
- Author an automated declarative `Jenkinsfile` executing linting, testing, packaging, and artifact publishing.
- Configure automated build triggers on Git repository commits.

### 2.2 Implementation Details
- **Containerized Jenkins Environment (`jenkins/`)**:
  - **Base Image**: Built from official `jenkins/jenkins:lts` with pre-installed Node.js 20, npm, Docker CLI, and curl.
  - **Docker-outside-of-Docker (DooD)**: The host Docker socket (`/var/run/docker.sock`) is mounted into the container with group alignment (`group_add`), allowing Jenkins to run container builds natively on Windows Docker Desktop.
  - **Port Mapping**: Jenkins web UI mapped to host port **`8085`** (`8085:8080`) and agent port **`50000`** (`50000:50000`) to completely eliminate port conflicts with application services.
  - **Automation Script**: `jenkins/setup-jenkins.ps1` automates Docker volume creation, custom container building, startup, and extraction of the initial administrative token.
- **Declarative Pipeline (`Jenkinsfile`)**:
  - Configured with `pollSCM('H/2 * * * *')` to automatically detect upstream commits on `origin/develop`.
  - **Stage 1: Checkout** — Clones `origin/develop` with submodules and records Git commit hashes.
  - **Stage 2: Lint & Code Quality** — Runs `npm ci` and `node --check` across backend source files.
  - **Stage 3: Unit & Integration Tests** — Runs automated test suites and validates dependency vulnerability trees.
  - **Stage 4: Build & Package** — Compiles the React frontend application into optimized static assets (`dist/`) and packages backend distribution bundles.
  - **Stage 5: Archive Artifacts** — Compresses release bundles into `release/taskmanager-frontend.tar.gz` and `release/taskmanager-backend.tar.gz`, archiving them directly within Jenkins build history.

### 2.3 Verification & Status
- **Build Status**: Verified through consecutive builds (Build #1 through Build #12).
- **Latest Build**: Build #12 completed with **`SUCCESS`** on commit `5b7d4af`.
- Build logs confirm all 5 stages passed cleanly without regressions.

---

## Phase 3: Docker Containerization & Multi-Container Compose

### 3.1 Objectives
- Package both frontend and backend into minimal, secure, production-grade Docker containers.
- Enforce non-root execution contexts and healthcheck definitions.
- Provide a unified local development environment using Docker Compose.

### 3.2 Implementation Details
- **Backend Dockerfile (`app/backend/Dockerfile`)**:
  - **Multi-Stage Build**:
    - Stage 1 (`deps`): Installs production-only dependencies using `npm ci --omit=dev`.
    - Stage 2 (`runner`): Copies production `node_modules` and source code onto a clean `node:20-alpine` base.
  - **Security**: Runs under non-root system user `taskapp` (UID `1001`, GID `1001`). Drops root privileges completely.
  - **Healthcheck**: Evaluates API health via `node -e "fetch('http://127.0.0.1:3000/health')..."` every 10s.
- **Frontend Dockerfile (`app/frontend/Dockerfile`)**:
  - **Multi-Stage Build**:
    - Stage 1 (`build`): Compiles React 18 / Vite / Tailwind source code into production static assets.
    - Stage 2 (`production`): Uses `nginx:1.27-alpine` to serve static assets and proxy API calls.
  - **Security**: Configured to run unprivileged as user `nginx` (UID `101`). Writable cache directories (`/var/cache/nginx`, `/var/run`) properly permissioned.
  - **Healthcheck**: Probes local HTTP server via `wget --spider -q http://127.0.0.1/`.
- **Nginx Reverse Proxy (`app/frontend/nginx.conf`)**:
  - Solves Cross-Origin Resource Sharing (CORS) by proxying all `/api/` and `/health` requests directly to `http://backend:3000`.
  - Enables clean single-page application (SPA) client routing via `try_files $uri $uri/ /index.html`.
- **Docker Compose (`docker-compose.yml`)**:
  - Orchestrates `taskmanager-backend` on port `3000:3000` and `taskmanager-frontend` on port `8080:80`.
  - Configures container dependency ordering: `frontend` waits on `backend` using `condition: service_healthy`.
  - Connected via custom bridge network `taskmanager-network`.
  - Database connects securely to cloud Supabase PostgreSQL over SSL, removing the overhead and fragility of local database containers.

### 3.3 Verification & Status
- Both containers build reproducibly and execute simultaneously.
- `docker compose ps` reports both containers in state `Up (healthy)`.
- Full user authentication, task creation, and REST endpoints verified via browser at `http://localhost:8080`.

---

## Phase 4: Kubernetes Orchestration & Cluster Management

### 4.1 Objectives
- Deploy the application to local Kubernetes (Docker Desktop).
- Implement declarative Kubernetes objects adhering to cloud-native standards.
- Demonstrate core production orchestration operations: rolling updates, scaling, rollbacks, and persistent storage.

### 4.2 Implementation Details
- **Manifest Architecture (`k8s/`)**:
  - `namespace.yaml`: Creates isolated namespace `task-manager`.
  - `configmap.yaml`: Non-sensitive configuration (`PORT: "3000"`, `NODE_ENV: "production"`, `LOG_LEVEL: "info"`).
  - `secret.yaml`: Sensitive credentials (`DATABASE_URL`, `JWT_SECRET`) injected as environment variables.
  - `backend-deployment.yaml`: 2 replicas, image `taskmanager-backend:v1.0.0`, liveness probe on `GET /`, readiness probe on `GET /health`, resource requests/limits, and `/app/logs` volume mount.
  - `backend-service.yaml`: Internal `ClusterIP` on port `3000`.
  - `frontend-deployment.yaml`: 2 replicas, image `taskmanager-frontend:v1.0.1`, Nginx reverse proxying to `backend-service:3000`.
  - `frontend-service.yaml`: `LoadBalancer` exposing the application externally on host port `80`.
  - `ingress.yaml`: Host-based routing for `task-manager.local`.
  - `rbac.yaml`: Restricted ServiceAccount (`task-manager-operator`) bound via RoleBinding to namespace-scoped operations.
- **Persistent Storage Implementation (`task-manager-pv.yaml` & `task-manager-pvc.yaml`)**:
  - Allocates 1Gi `hostPath` PersistentVolume and PersistentVolumeClaim mounted at `/app/logs`.
  - **Permission Alignment**: Because `hostPath` mounts default to `root:root (0755)` and `fsGroup` is not supported on hostPath, an `initContainer` (`init-storage-permissions`) executes `chown -R 1001:1001 /app/logs` prior to backend initialization, enabling non-root UID 1001 write access.
  - **Twelve-Factor Compliance**: Application logs to `process.stdout` using Pino; `/app/logs` is strictly maintained as an academic persistent volume demonstration.

### 4.3 Demonstration of Operations
1. **Scaling**:
   - Scaled backend deployment from 2 to 4 replicas: `kubectl scale deployment/backend --replicas=4 -n task-manager`.
   - Verified 4/4 pods entered `Running` state and handled round-robin traffic.
   - Scaled back to 2 replicas cleanly without dropped requests.
2. **Zero-Downtime Rolling Update**:
   - Updated backend image tag: `kubectl set image deployment/backend backend=taskmanager-backend:v1.0.1 -n task-manager`.
   - Kubernetes rolled out new pods incrementally while maintaining availability (`maxUnavailable: 0`, `maxSurge: 1`).
3. **Rollback**:
   - Executed rollback: `kubectl rollout undo deployment/backend -n task-manager`.
   - Verified cluster cleanly reverted to revision 1 (`taskmanager-backend:v1.0.0`).
4. **Storage Persistence Across Pod Termination**:
   - Created `/app/logs/persistence-verification.txt` from pod A.
   - Verified replica pod B successfully read the file.
   - Force-deleted pod A; verified the replacement pod spawned by Kubernetes could read the test file via the PVC.
   - Removed temporary test file upon test completion.

---

## Phase 5: Ansible Automation & Configuration Management

### 5.1 Objectives
- Provide automated configuration management and server orchestration using Ansible.
- Execute playbooks from Ubuntu on WSL2 targeting local or remote Linux hosts.
- Automate Docker installation, Kubernetes control-plane setup, application deployment, and configuration updates.

### 5.2 Implementation Details
- **Directory Structure (`ansible/`)**:
  ```text
  ansible/
  ├── ansible.cfg                      # Configured with roles_path, inventory, and host_key_checking = False
  ├── inventory/
  │   └── hosts.ini                    # Separates [local] (localhost) from [k8s_nodes] (Linux targets)
  └── playbooks/
      ├── install_docker.yml           # Preflight checks, apt keyrings, docker-ce, containerd
      ├── install_kubernetes.yml       # containerd SystemdCgroup, pinned kubeadm/kubelet/kubectl v1.30
      ├── deploy_application.yml       # Declarative deployment of k8s manifests, rollout verification
      └── configure_application.yml    # Idempotent ConfigMap management and dynamic backend rollout
  ```
- **Technical Capabilities**:
  - **Preflight Host Safeguards**: `install_docker.yml` and `install_kubernetes.yml` assert that target hosts are Linux and reject localhost execution to protect Docker Desktop.
  - **Idempotent Container Runtime**: Configures containerd `config.toml` enforcing `SystemdCgroup = true` using `blockinfile` or `template`, restarting containerd only upon detected diffs.
  - **Consistent Kubernetes Versioning**: Pins Kubernetes repository and packages consistently to minor version `1.30` (`k8s_apt_release: "v1.30"`).
  - **Kubeconfig Handling**: Derives control-plane admin kubeconfig predictably from `ansible_user_dir` rather than fragile `ansible_env.HOME`.
  - **Safe Credential Handling**: `deploy_application.yml` excludes `k8s/secret.yaml` from automatic apply; operators supply production secrets via encrypted Ansible Vault or secure CLI arguments.

### 5.3 Verification & Status
- Playbook syntax validated via `ansible-playbook --syntax-check`.
- In-cluster deployment and configuration tasks verified against the active `docker-desktop` cluster context.
- ConfigMap modifications successfully triggered zero-downtime rolling restarts only when data changed.

---

## Phase 6: Terraform Infrastructure as Code (IaC)

### 6.1 Objectives
- Manage container infrastructure declaratively using Terraform.
- Implement reusable modules, input variables, and informative outputs.
- Maintain complete isolation between development, Kubernetes production, and Terraform-managed stacks.

### 6.2 Implementation Details
- **Directory Structure (`terraform/`)**:
  ```text
  terraform/
  ├── .gitignore                       # Excludes .terraform/, *.tfstate, *.tfvars
  ├── README.md                        # IaC documentation, security warnings, execution steps
  ├── main.tf                          # Root module: docker network, persistent volume, module calls
  ├── variables.tf                     # Parameterized variables (images, host ports, secrets)
  ├── outputs.tf                       # Published endpoints and container identifiers
  ├── terraform.tfvars.example         # Sanitized variable template
  └── modules/
      └── docker_container/            # Reusable container module
          ├── main.tf                  # docker_container resource definition
          ├── variables.tf             # Module interface
          └── outputs.tf               # Container metadata outputs
  ```
- **Provider & Resources**:
  - Pinned provider: `kreuzwerker/docker` (`~> 3.0.2`).
  - Provisions custom bridge network `taskmanager-tf-network` and volume `taskmanager-tf-logs`.
  - Deploys isolated container instances on alternate host ports:
    - Backend: mapped to host port **`3001`** (`3001:3000`).
    - Frontend: mapped to host port **`8088`** (`8088:80`).
- **Security & Secret Safeguards**:
  - Removed all insecure JWT secret defaults. `jwt_secret` is declared with `sensitive = true` and requires explicit input.
  - Documented `.tfstate` security boundaries: `sensitive = true` only masks values in terminal output—it does **not** encrypt values within the `.tfstate` JSON file. Documented state file encryption and `.gitignore` requirements.

### 6.3 Verification & Status
- Validated via `terraform fmt -check`, `terraform init`, and `terraform validate`.
- `terraform apply` completed successfully with 0 errors.
- Verified live response on `http://localhost:8088/` and `http://localhost:3001/health`.
- `terraform destroy` cleanly tore down resources without impacting Kubernetes or Docker Compose.

---

## Phase 7: Full-Stack Observability with Prometheus & Grafana

### 7.1 Objectives
- Implement comprehensive monitoring across application, cluster, and container layers.
- Auto-provision Prometheus, `kube-state-metrics`, Metrics Server, and Grafana.
- Eliminate hardcoded passwords and dynamically inject credentials at deploy time.
- Provide a pre-configured 8-panel Grafana operations dashboard.

### 7.2 Implementation Details
- **Directory Structure (`monitoring/`)**:
  ```text
  monitoring/
  ├── README.md                         # Full observability and operations guide
  ├── namespace.yaml                    # monitoring namespace
  ├── metrics-server.yaml               # Metrics Server with --kubelet-insecure-tls
  ├── deploy.ps1                        # One-click deployment script enforcing $env:GRAFANA_ADMIN_PASSWORD
  ├── dashboards/
  │   └── dashboard-task-manager.json   # Standalone Grafana dashboard JSON (UID: task-manager-overview)
  ├── kube-state-metrics/
  │   ├── rbac.yaml                     # ServiceAccount, ClusterRole (pods/namespaces read), ClusterRoleBinding
  │   ├── deployment.yaml               # Pinned v2.12.0, non-root UID 65534, resource limits
  │   └── service.yaml                  # ClusterIP service on port 8080
  ├── prometheus/
  │   ├── rbac.yaml                     # Prometheus ServiceAccount & ClusterRole
  │   ├── configmap.yaml                # Scrape configs: backend, cadvisor, ksm, prometheus
  │   ├── deployment.yaml               # Prometheus v2.51.0, non-root UID 65534
  │   └── service.yaml                  # ClusterIP service on port 9090
  └── grafana/
      ├── configmap-datasources.yaml    # Automated Prometheus datasource provisioner
      ├── configmap-dashboards.yaml     # Dashboard provider pointing to /var/lib/grafana/dashboards
      ├── configmap-dashboard-json.yaml # Auto-generated ConfigMap wrapping the dashboard JSON
      ├── deployment.yaml               # Grafana v10.4.0, non-root UID 472
      └── service.yaml                  # ClusterIP service on port 3000
  ```

- **Observability Metrics Layers**:
  1. **Application Layer (`prom-client`)**: Scrapes Express API `/metrics` capturing `http_requests_total` and `http_request_duration_seconds` histogram buckets.
  2. **Runtime Layer (Node.js)**: Captures `process_cpu_seconds_total`, `process_resident_memory_bytes`, and V8 heap stats.
  3. **Cluster Object Layer (`kube-state-metrics`)**: Pinned to `v2.12.0`, least-privilege RBAC reading `pods` and `namespaces`. Exposes `kube_pod_status_ready`.
  4. **Container & Node Layer (cAdvisor & Metrics Server)**: Captures `container_cpu_usage_seconds_total` and `container_memory_working_set_bytes`. Powers `kubectl top nodes` and `kubectl top pods`.

- **Security & Secret Handling**:
  - `monitoring/grafana/secret.yaml` was completely removed from version control.
  - `deploy.ps1` mandates `$env:GRAFANA_ADMIN_PASSWORD` and halts execution if missing or empty.
  - Dynamically provisions `grafana-secret` via `kubectl create secret generic grafana-secret ... --dry-run=client -o yaml | kubectl apply -f -` without printing passwords to output.
  - Prometheus, Grafana, and kube-state-metrics remain internal `ClusterIP` services.

### 7.3 Grafana Dashboard Panels (`task-manager-overview`)

| Panel # | Panel Title | Visualizer | Metric / PromQL Query | Purpose |
| :---: | :--- | :---: | :--- | :--- |
| **1** | **Backend Metrics Endpoint Scrape Status** | Stat | `up{job="task-manager-backend"}` | Confirms Prometheus successfully scrapes backend `:3000/metrics`. |
| **8** | **Application Pod Readiness (kube-state-metrics)** | Stat | `kube_pod_status_ready{namespace="task-manager", condition="true"}` | Confirms all backend and frontend pods are ready to serve live traffic. |
| **2** | **Backend HTTP Request Rate** | Time Series | `sum(rate(http_requests_total{job="task-manager-backend"}[1m])) by (method, route, status_code)` | Tracks API throughput and status code distribution (200s, 401s, 500s). |
| **3** | **HTTP Request Latency (Avg & p95)** | Time Series | Avg & `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[1m])) by (le))` | Monitors application responsiveness and latency spikes. |
| **4** | **Backend Process CPU Usage** | Time Series | `rate(process_cpu_seconds_total{job="task-manager-backend"}[1m]) * 100` | Tracks Node.js event loop CPU utilization percentage. |
| **5** | **Backend Process Memory Usage** | Time Series | `process_resident_memory_bytes`, `nodejs_heap_size_used_bytes`, `nodejs_heap_size_total_bytes` | Guards against memory leaks and tracks V8 garbage collection. |
| **6** | **Pod CPU Usage (cAdvisor)** | Time Series | `sum(rate(container_cpu_usage_seconds_total{namespace="task-manager", container=~"backend\|frontend"}[1m])) by (pod, container) * 100` | Measures actual container CPU usage against cgroup limits. |
| **7** | **Pod Memory Usage (cAdvisor)** | Time Series | `sum(container_memory_working_set_bytes{namespace="task-manager", container=~"backend\|frontend"}) by (pod, container)` | Tracks container working set memory to prevent Kubernetes OOM kills. |

### 7.4 Verification Results
- **Script Validation**: Executing `deploy.ps1` without `$env:GRAFANA_ADMIN_PASSWORD` fails immediately with exit code `1`. When provided, secret is created without leaking credentials.
- **Grafana API Authentication**: Verified via Basic Auth against `/api/dashboards/uid/task-manager-overview` returning HTTP `200 OK` with 8 provisioned panels.
- **Scrape Targets**: Prometheus targets API confirms all 4 jobs are **`UP`** (`task-manager-backend`, `kube-state-metrics`, `kubernetes-cadvisor`, `prometheus`).
- **Readiness Metric**: Querying `kube_pod_status_ready{namespace="task-manager", condition="true"}` reports `1` for all 4 application pods.
- **Jenkins CI Verification**: Git commit `5b7d4af` triggered Jenkins Build #12, completing with **`SUCCESS`**.

---

## Phase Comparison & Engineering Matrix

| Feature / Dimension | Phase 3 (Docker Compose) | Phase 4 (Kubernetes) | Phase 5 (Ansible) | Phase 6 (Terraform) | Phase 7 (Monitoring) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Tool** | Docker Compose v2 | Kubernetes (Docker Desktop) | Ansible 2.16+ (WSL2) | Terraform 1.5+ | Prometheus & Grafana |
| **Deployment Target**| Local Docker Engine | `task-manager` Namespace | Linux Nodes / K8s Cluster | Isolated Docker Network | `monitoring` Namespace |
| **Frontend Access** | `http://localhost:8080` | `http://localhost:80` | Managed K8s Service | `http://localhost:8088` | Port-forward `:3001` |
| **Backend Access** | `http://localhost:3000` | Internal `backend-service` | Managed K8s Service | `http://localhost:3001` | Port-forward `:9090` |
| **Replication** | 1 Container per service | 2 Replicas per deployment | Automated K8s Scaling | 1 Container per module | 1 Replica per monitor |
| **Self-Healing** | Container restart policies | Automated Pod rescheduling | Automated deployment checks| Re-created via state plan | Pod restarts via probes |
| **Storage Strategy** | Ephemeral / Volume bind | 1Gi `hostPath` PV/PVC | Managed manifests | `taskmanager-tf-logs` vol | ConfigMaps & Secrets |
| **Security Context** | Non-root `taskapp`/`nginx`| UID 1001 / UID 101 | Sudo preflights & RBAC | Parameterized non-root | UID 65534 & UID 472 |
| **Secret Management** | Local `.env` | K8s Secret | Ansible Vault / Env args | Sensitive vars (No default)| Dynamic Secret in deploy |

---

## Operations & Verification Quick Reference

### 1. Docker Compose (Local Dev)
```powershell
docker compose up -d --build
docker compose ps
docker compose logs -f
```

### 2. Kubernetes Deployment (Production Cluster)
```powershell
powershell -ExecutionPolicy Bypass -File .\k8s\deploy.ps1
kubectl get pods,services,pvc -n task-manager
```

### 3. Terraform (Isolated Infrastructure)
```bash
cd terraform
terraform init
terraform plan
terraform apply -auto-approve
terraform destroy -auto-approve
```

### 4. Monitoring Stack Deployment & Access
```powershell
# Set required admin password
$env:GRAFANA_ADMIN_PASSWORD = 'YourStrongAdminPasswordHere!'

# Run one-click deployment
powershell -ExecutionPolicy Bypass -File .\monitoring\deploy.ps1

# Access Grafana Dashboard (Port 3001)
kubectl port-forward svc/grafana-service 3001:3000 -n monitoring

# Access Prometheus Targets (Port 9090)
kubectl port-forward svc/prometheus-service 9090:9090 -n monitoring
```

---

## Conclusion & Capstone Assessment

The Task Management System DevOps Capstone has successfully fulfilled all technical, architectural, security, and operational criteria across all seven phases:
- **Continuous Integration** is verified through Jenkins Build #12 passing all automated test, lint, build, and packaging stages.
- **Containerization & Orchestration** are verified through non-root Docker builds and multi-replica, self-healing Kubernetes deployments with rolling update and rollback capabilities.
- **Infrastructure as Code & Configuration Automation** are verified through modular Terraform code and hardened Ansible playbooks.
- **Observability & Security** are verified through automated Prometheus scraping, least-privilege `kube-state-metrics`, dynamic zero-leak credential provisioning, and real-time Grafana dashboard visualization.

The entire codebase is clean, tested, documented, and fully synchronized on the `develop` branch of `https://github.com/Nik848/task-manager-devops`.
