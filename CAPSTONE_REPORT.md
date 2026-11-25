# Task Management System — DevOps Capstone Engineering Report
## Complete Implementation & Verification Report (Phases 1 through 11)

**Repository:** `https://github.com/Nik848/task-manager-devops`  
**Target Branch:** `develop`  
**Execution Environment:** Windows 11 Host, Docker Desktop (Single-Node Kubernetes `docker-desktop`), Ubuntu on WSL2  
**Database:** Cloud-Managed PostgreSQL (Supabase) via SSL Connection Pooler  
**Latest Verified Commit:** `c87e07d` (`fix(ansible): defer RBAC to ArgoCD and fail safely on cluster errors`)  
**CI/CD Pipeline Status:** Jenkins Build #30 — **SUCCESS**  
**GitOps Synchronization:** ArgoCD Application `task-manager-gitops` — **Synced & Healthy**

---

## Executive Summary

This engineering document provides the comprehensive architectural report, technical implementation records, security analysis, and operational verification procedures for the **Task Management System DevOps Capstone Project**. Across eleven sequential engineering phases, a full-stack monorepo application was transitioned from local source code into a fully automated, cloud-native, secured, observed, continuously delivered, and highly resilient software platform:

1. **Phase 1: Source Code Management & Branching Strategy** — Monorepo setup, GitFlow branching model (`main`, `develop`, feature branches), peer-review standards (`CONTRIBUTING.md`), and issue templates.
2. **Phase 2: Continuous Integration with Jenkins** — Containerized Jenkins running via Docker-outside-of-Docker (DooD), automated 5-stage declarative pipeline (`Jenkinsfile`), SCM polling triggers, and build artifact archiving.
3. **Phase 3: Docker Containerization & Multi-Container Compose** — Multi-stage non-root Dockerfiles for Express API and React SPA, production Nginx reverse proxy, and local multi-container orchestration with Docker Compose.
4. **Phase 4: Kubernetes Orchestration & Cluster Management** — Complete declarative manifests in `k8s/`, non-root security contexts, dual replicas, health probes, rolling updates, rollbacks, and persistent storage demonstrations.
5. **Phase 5: Configuration Management & Automation with Ansible** — Production Ansible playbooks executing from Ubuntu WSL2 for Docker engine installation, Kubernetes control-plane/worker bootstrapping, declarative application deployment, and idempotent ConfigMap configuration.
6. **Phase 6: Infrastructure as Code (IaC) with Terraform** — Declarative container infrastructure management using `kreuzwerker/docker` provider, modular architecture, parameterized variables, and security controls over state-file credential storage.
7. **Phase 7: Full-Stack Observability with Prometheus & Grafana** — Comprehensive metrics collection via Prometheus, `kube-state-metrics` for pod readiness, Kubelet cAdvisor for container CPU/RAM, Kubernetes Metrics Server, and a provisioned 8-panel Grafana dashboard with zero hardcoded credentials.
8. **Phase 8: Centralized Logging with Fluentd** — DaemonSet-based log collection in namespace `logging`, tailing container CRI logs from `/var/log/containers/*.log`, metadata enrichment via Kubernetes API, structured JSON parsing for application Pino logs, and centralized hostPath storage in `/var/log/fluentd-central/`.
9. **Phase 9: Comprehensive Security Implementation (DevSecOps)** — SonarQube static code quality & security analysis, Trivy automated container vulnerability scanning in CI, base image hardening (Alpine pinned versions with stripped build tools), least-privilege Kubernetes RBAC, and secure secret segregation without default credentials.
10. **Phase 10: Blue-Green Deployment Strategy** — Production-grade zero-downtime deployment architecture on Kubernetes utilizing parallel versioned environments (`blue` on `v1.0.1` and `green` on `v2.0.0-green`), automated pre-flight health validation, atomic Service selector switching, and automated rollback controller (`k8s/blue-green.ps1`).
11. **Phase 11: GitOps Implementation Using ArgoCD** — Declarative Continuous Delivery using ArgoCD (`v3.6.1`) in namespace `argocd`, managing `gitops/manifests/` from `develop`, automated self-healing, Service selector difference suppression for Blue-Green compatibility, and complete ownership reconciliation across Ansible, ArgoCD, and Kubernetes resources.

---

## Architecture Overview

```text
                                                DEVELOPER WORKFLOW
                                           ┌───────────────────────────┐
                                           │  Developer pushes to Git  │
                                           │  (branch: origin/develop) │
                                           └─────────────┬─────────────┘
                                                         │
                                                         ▼
                                           ┌───────────────────────────┐
                                           │       Jenkins Server      │
                                           │  (Docker DooD, Port 8085) │
                                           │  • Lint & Code Quality    │
                                           │  • SonarQube Scan (:9000) │
                                           │  • Unit & Integration Test│
                                           │  • Build Hardened Images  │
                                           │  • Trivy Container Scan   │
                                           │  • Archive Release Build  │
                                           └─────────────┬─────────────┘
                                                         │
                                                         ▼
                                           ┌───────────────────────────┐
                                           │    ArgoCD GitOps Engine   │
                                           │  (Namespace: argocd :8084)│
                                           │  • Continuous Sync (git)  │
                                           │  • Self-Healing & Prune   │
                                           │  • Respects BG Selectors  │
                                           └─────────────┬─────────────┘
                                                         │ Reconciles Manifests
                                                         ▼
                                          KUBERNETES CLUSTER (docker-desktop)
    ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
    │  Namespace: task-manager (Blue-Green Architecture)                                                             │
    │                                                                                                                 │
    │  Traffic Entry:                                                                                                 │
    │  frontend-service (LoadBalancer :80) ──── selector: version=blue ───┐                                          │
    │  backend-service (ClusterIP :3000)   ──── selector: version=blue ───┤                                          │
    │                                                                     │                                          │
    │         ACTIVE BLUE ENVIRONMENT (v1.0.1)                            │     IDLE / STAGED GREEN (v2.0.0-green)   │
    │     ┌──────────────────────────────────────┐                        │    ┌───────────────────────────────────┐ │
    │     │ frontend-blue Deployment (2 replicas)│ ◄──────────────────────┘    │ frontend-green (2 replicas)       │ │
    │     │ backend-blue Deployment (2 replicas) │                             │ backend-green (2 replicas)        │ │
    │     └──────────────────┬───────────────────┘                             └─────────────────┬─────────────────┘ │
    │                        │                                                                   │                   │
    │                        └───────────────────────────────┬───────────────────────────────────┘                   │
    │                                                        ▼                                                       │
    │                                   ConfigMap (task-manager-config) [ArgoCD Owned]                               │
    │                                   Secret (task-manager-secret)    [Separately Provisioned]                     │
    │                                   PVC (task-manager-pvc)          [1Gi hostPath /app/logs]                     │
    └────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────┘
                                                             │
                 ┌───────────────────────────────────────────┼───────────────────────────────────────────┐
                 ▼                                           ▼                                           ▼
    ┌─────────────────────────┐                 ┌─────────────────────────┐                 ┌─────────────────────────┐
    │ OBSERVABILITY (Phase 7) │                 │ CENTRAL LOGGING (Ph 8)  │                 │ CLOUD DATABASE (Supabase│
    │ Namespace: monitoring   │                 │ Namespace: logging      │                 │ External PostgreSQL     │
    │ • Prometheus (:9090)    │                 │ • Fluentd DaemonSet     │                 │ SSL Pooler Connection   │
    │ • Grafana (:3001)       │                 │ • Tails /var/log/pods   │                 │ Port 5432 / 6543        │
    │ • kube-state-metrics    │                 │ • Centralized JSON logs │                 └─────────────────────────┘
    │ • cAdvisor & Node Metrics│                │   /var/log/fluentd-cent/│
    └─────────────────────────┘                 └─────────────────────────┘
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
  - **Automation Script**: [jenkins/setup-jenkins.ps1](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/jenkins/setup-jenkins.ps1) automates Docker volume creation, custom container building, startup, and extraction of the initial administrative token.
- **Declarative Pipeline (`Jenkinsfile`)**:
  - Configured with `pollSCM('H/2 * * * *')` to automatically detect upstream commits on `origin/develop`.
  - **Stage 1: Checkout** — Clones `origin/develop` with submodules and records Git commit hashes.
  - **Stage 2: Lint & Code Quality** — Runs `npm ci` and `node --check` across backend source files.
  - **Stage 3: SonarQube Analysis** (Added in Phase 9) — Runs static analysis and Quality Gate evaluation.
  - **Stage 4: Unit & Integration Tests** — Runs automated test suites and validates dependency vulnerability trees.
  - **Stage 5: Build & Package** — Compiles the React frontend application into optimized static assets (`dist/`) and packages backend distribution bundles.
  - **Stage 6: Docker Image Build** — Builds production images tagged with build IDs and version tags.
  - **Stage 7 & 8: Trivy Vulnerability Scans** (Added in Phase 9) — Scans backend and frontend images for vulnerabilities.
  - **Stage 9: Archive Artifacts** — Compresses release bundles into `release/taskmanager-frontend.tar.gz` and `release/taskmanager-backend.tar.gz`, archiving them directly within Jenkins build history.

### 2.3 Verification & Status
- **Build Status**: Verified through consecutive builds (Build #1 through Build #30).
- **Latest Build**: Build #30 completed with **`SUCCESS`**. All stages passed cleanly without regressions.

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
    - Stage 2 (`runner`): Copies production `node_modules` and source code onto a clean `node:20.20.2-alpine3.23` base.
  - **Security**: Runs under non-root system user `taskapp` (UID `1001`, GID `1001`). Drops root privileges completely.
  - **Healthcheck**: Evaluates API health via `node -e "fetch('http://127.0.0.1:3000/health')..."` every 10s.
- **Frontend Dockerfile (`app/frontend/Dockerfile`)**:
  - **Multi-Stage Build**:
    - Stage 1 (`build`): Compiles React 18 / Vite / Tailwind source code into production static assets.
    - Stage 2 (`production`): Uses `nginx:1.27.5-alpine` to serve static assets and proxy API calls.
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
  - **GitOps Deference (Phase 11 Update)**: Both `configure_application.yml` and `deploy_application.yml` inspect the cluster for the ArgoCD Application `task-manager-gitops`. If GitOps is active, playbooks safely defer ConfigMap and RBAC management to ArgoCD, preventing configuration drifts or destructive overwrites.

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

---

## Phase 8: Centralized Logging with Fluentd

### 8.1 Objectives
- Implement centralized log aggregation across all Kubernetes nodes and workloads.
- Parse structured JSON logs (Pino) from the application while collecting plain-text container stdout/stderr.
- Attach Kubernetes cluster metadata (pod name, namespace, labels) to log records.
- Write structured logs to durable centralized storage with daily time-slicing and rotation policies.

### 8.2 Implementation Details
- **Architecture (`logging/`)**:
  ```text
  logging/
  ├── README.md          # Full operations, storage, and verification manual
  ├── namespace.yaml     # Dedicated 'logging' namespace
  ├── rbac.yaml          # ServiceAccount + read-only ClusterRole (pods, namespaces)
  ├── configmap.yaml     # Fluentd fluent.conf pipeline definition
  ├── daemonset.yaml     # Fluentd DaemonSet (resource limits, tolerations, hostPath mounts)
  └── deploy.ps1         # One-click Windows PowerShell deployment script
  ```
- **DaemonSet Log Collection**:
  - Uses official `fluent/fluentd-kubernetes-daemonset:v1.17-debian-forward-1` deployed in namespace `logging`.
  - Tails container `stdout`/`stderr` from `/var/log/containers/*.log` via host mount `/var/log/pods`, matching containerd CRI formats.
  - Excludes Fluentd's own container logs (`exclude_path`) to prevent infinite ingestion loops.
- **Metadata Filtering & JSON Parsing**:
  - Uses `fluent-plugin-kubernetes_metadata_filter` via a read-only ServiceAccount (`pods`, `namespaces` only—no Secret access) to enrich records with pod, container, and namespace metadata.
  - Application logs from `task-manager` are parsed with `@type parser` / `format json` (preserving Pino's `level`, `time`, `msg`, `reqId`, `status_code`), tagged as `log_category: "application"`.
  - Cluster and infrastructure logs from `kube-system`, `monitoring`, and `argocd` are tagged as `log_category: "infrastructure"`.
- **Durable Local Storage**:
  - Flushes records every 5s (`timekey 1d`) into `/var/log/fluentd-central/`:
    - Application logs: `/var/log/fluentd-central/application/app.YYYYMMDD.log`
    - Infrastructure logs: `/var/log/fluentd-central/infrastructure/infra.YYYYMMDD.log`

### 8.3 Verification & Status
- DaemonSet verified with 1/1 ready pods across nodes.
- Syntax validated using `fluentd --dry-run -c /fluentd/etc/fluent.conf`.
- Live inspection confirmed Pino request logs (e.g., `GET /health`, `POST /api/auth/login`) correctly formatted and written to daily log files.

---

## Phase 9: Comprehensive Security Implementation (DevSecOps)

### 9.1 Objectives
- Implement end-to-end security analysis across code, containers, clusters, and CI/CD pipelines.
- Integrate SonarQube for static application security testing (SAST) and code quality gates.
- Implement Trivy container image vulnerability scanning into the Jenkins CI pipeline.
- Harden Docker container base images, eliminate high/critical CVEs, and drop build tools.
- Audit Kubernetes RBAC policies to enforce strict least-privilege principles and prevent credential leakage.

### 9.2 Implementation Details
- **SonarQube Integration (`security/docker-compose.sonarqube.yml`)**:
  - Deploys pinned `sonarqube:25.12.0.117093-community` on port `9000:9000` with persistent volumes.
  - Project configuration defined in `sonar-project.properties`.
  - SonarQube authentication token stored securely inside Jenkins Credentials (`sonarqube-token`), injected via `withCredentials`, and masked in build consoles.
  - Jenkins executes SonarScanner CLI with `-Dsonar.javascript.node.maxspace=512` to prevent JavaScript/CSS analyzer memory spikes.
- **Container Vulnerability Scanning & Image Hardening**:
  - Upgraded backend base image to `node:20.20.2-alpine3.23` and frontend to `nginx:1.27.5-alpine`.
  - Executed `apk upgrade --no-cache` to eliminate base OS package vulnerabilities.
  - Stripped unnecessary package managers (`npm`, `corepack`) from the backend production runner stage.
  - Upgraded backend dependency `drizzle-orm` to `^0.45.2` to resolve `CVE-2026-39356`.
  - Integrated Trivy stages into `Jenkinsfile` running `trivy image --exit-code 1 --severity HIGH,CRITICAL` against both built container images.
- **Kubernetes Secret & RBAC Hardening**:
  - Updated [k8s/deploy.ps1](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/k8s/deploy.ps1) to completely eliminate insecure default admin credentials (`admin@example.com` / `changeme123`). Required values must be explicitly supplied in `.env` or pre-existing in Kubernetes Secrets.
  - Narrowed [k8s/rbac.yaml](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/k8s/rbac.yaml) ServiceAccount `task-manager-operator` to namespace-scoped read actions and deployments management, documented as an explicit demonstration account with zero Secret access.
  - Set `automountServiceAccountToken: false` across backend and frontend application pods to prevent unauthorized API server interaction.

### 9.3 Verification & Status
- SonarQube Quality Gate status: **PASSED** (0 Bugs, 0 Vulnerabilities, 0 Security Hotspots).
- Trivy vulnerability scans: **0 HIGH, 0 CRITICAL** vulnerabilities detected on both images.
- Kubernetes RBAC audit confirmed `task-manager-operator` and application pods cannot read Kubernetes secrets.

---

## Phase 10: Blue-Green Deployment Strategy

### 10.1 Objectives
- Implement a zero-downtime Blue-Green deployment architecture on Kubernetes.
- Deploy parallel production environments (`blue` and `green`) sharing ConfigMaps, Secrets, and storage.
- Provide automated pre-flight health validation, atomic traffic cutover, and instant rollback capabilities.

### 10.2 Implementation Details
- **Architecture & Manifests (`k8s/blue-green/`)**:
  - `backend-blue.yaml` & `frontend-blue.yaml`: Active baseline environment running version `v1.0.1` (`app=backend,version=blue`).
  - `backend-green.yaml` & `frontend-green.yaml`: Target release environment running version `v2.0.0-green` (`app=backend,version=green`).
  - `backend-service.yaml` (`ClusterIP :3000`) and `frontend-service.yaml` (`LoadBalancer :80`): Use selector `version: blue` as default, routing incoming traffic to the active environment.
  - Shared infrastructure: Both environments reuse `task-manager-config`, `task-manager-secret`, `task-manager-pvc`, and Supabase PostgreSQL without resource duplication.
- **Controller Automation Script (`k8s/blue-green.ps1`)**:
  - **`status`**: Queries and displays Blue/Green deployment readiness, pod replicas, image tags, and currently active Service selectors.
  - **`deploy-green`**: Applies Green manifests, waits for rollout completion, and executes out-of-band health probes (`/health` and `/`) via temporary port-forwarding before allowing traffic cutover.
  - **`switch-green`**: 
    1. Records active Service selectors.
    2. Validates target Green deployment readiness (2/2 ready pods).
    3. Atomically patches both `backend-service` and `frontend-service` selectors to `version=green`.
    4. Verifies `discovery.k8s.io/v1 EndpointSlices` converge exclusively to Green endpoints.
    5. Probes live external endpoints (`http://localhost/health` and `http://localhost/`).
    6. Automatically reverts to previous selectors if any step fails.
  - **`rollback-blue`**: Instantly switches selectors back to `version=blue` using identical safety validations.
- **Manifest Consistency & Redeployment Safeguards**:
  - Modified [k8s/deploy.ps1](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/k8s/deploy.ps1) to detect existing Service selectors dynamically and preserve active Green routing during cluster redeployments.

### 10.3 Verification & Live Cutover Results
- Verified initial Blue environment on `http://localhost` serving version `v1.0.1`.
- Executed `powershell -ExecutionPolicy Bypass -File .\k8s\blue-green.ps1 -Action switch-green`:
  - Target Green deployment validated healthy.
  - Selectors atomically updated to `green`.
  - Zero dropped HTTP connections recorded during traffic cutover.
- Executed `powershell -ExecutionPolicy Bypass -File .\k8s\blue-green.ps1 -Action rollback-blue`:
  - Instant rollback completed in `< 2` seconds, safely restoring traffic to Blue.

---

## Phase 11: GitOps Implementation Using ArgoCD

### 11.1 Objectives
- Implement declarative GitOps continuous delivery using ArgoCD on Kubernetes.
- Maintain a single source of truth for desired cluster state in Git (`gitops/`).
- Enable automated reconciliation, self-healing, and prune capabilities.
- Integrate GitOps seamlessly with Phase 10 Blue-Green deployments and Phase 5 Ansible playbooks.

### 11.2 Implementation Details
- **ArgoCD Deployment (`argocd` namespace)**:
  - Installed stable pinned ArgoCD release **`v3.6.1`** via official manifests using [gitops/setup-argocd.ps1](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/gitops/setup-argocd.ps1).
  - All core components running in high health: `argocd-server`, `argocd-repo-server`, `argocd-application-controller`, `argocd-redis`, `argocd-dex-server`.
  - UI accessible locally via secure port-forward: `kubectl port-forward svc/argocd-server 8084:443 -n argocd`. Initial admin credentials retrieved securely from Secret `argocd-initial-admin-secret`.
- **GitOps Repository Structure (`gitops/`)**:
  ```text
  gitops/
  ├── README.md                      # Full operations, architecture & troubleshooting guide
  ├── setup-argocd.ps1               # Stable ArgoCD v3.6.1 installation & validation script
  ├── application.yaml               # ArgoCD Application CR tracking origin/develop
  └── manifests/                     # Declarative Kubernetes source of truth
      ├── namespace.yaml             # task-manager namespace
      ├── configmap.yaml             # ConfigMap tagged with GITOPS_MANAGED: "true"
      ├── rbac.yaml                  # ServiceAccount, Role, RoleBinding
      ├── backend-service.yaml       # backend-service (ClusterIP :3000)
      ├── frontend-service.yaml      # frontend-service (LoadBalancer :80)
      ├── backend-blue.yaml          # Blue backend deployment (v1.0.1)
      ├── frontend-blue.yaml         # Blue frontend deployment (v1.0.1)
      ├── backend-green.yaml         # Green backend deployment (v2.0.0-green)
      └── frontend-green.yaml        # Green frontend deployment (v2.0.0-green)
  ```
- **Blue-Green Selector Compatibility (`ignoreDifferences`)**:
  - To prevent ArgoCD self-healing from reverting intentional Blue-Green traffic switches, `gitops/application.yaml` defines:
    ```yaml
    ignoreDifferences:
      - group: ""
        kind: Service
        name: backend-service
        jsonPointers:
          - /spec/selector
      - group: ""
        kind: Service
        name: frontend-service
        jsonPointers:
          - /spec/selector
    syncPolicy:
      syncOptions:
        - RespectIgnoreDifferences=true
        - ServerSideApply=true
    ```
- **Ownership & Boundary Reconciliation**:
  - **ArgoCD Authoritative Ownership**: ArgoCD is the sole authoritative owner of `task-manager-config`, RBAC manifests, and application Deployments.
  - **Excluded from GitOps**: `Secret/task-manager-secret`, `PV/task-manager-pv`, and `PVC/task-manager-pvc` are excluded from Git to prevent accidental credential leakage or persistent volume pruning.
  - **Ansible Deference**: Updated `ansible/playbooks/configure_application.yml` and `deploy_application.yml` to check for ArgoCD's `task-manager-gitops` Application. When detected, Ansible skips applying ConfigMaps and RBAC manifests, logging clear ownership notices.

### 11.3 Verification & Status
- Application status: **`Synced`** and **`Healthy`**.
- GitOps drift demonstration: Manually modifying replica counts or ConfigMap values triggers immediate ArgoCD automated self-heal back to the Git desired state.
- Blue-Green compatibility: Running `switch-green` via `k8s/blue-green.ps1` successfully updates Service selectors while ArgoCD maintains `Healthy` and `Synced` status without resetting the selector to Blue.

---

## Comprehensive Engineering Matrix (Phases 3 through 11)

| Dimension | Phase 3 (Docker Compose) | Phase 4 (Kubernetes) | Phase 5 (Ansible) | Phase 6 (Terraform) | Phase 7 (Monitoring) | Phase 8 (Logging) | Phase 9 (Security) | Phase 10 (Blue-Green) | Phase 11 (GitOps) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Tool** | Docker Compose v2 | kubectl / K8s | Ansible 2.16+ (WSL2)| Terraform 1.5+ | Prometheus & Grafana | Fluentd DaemonSet | SonarQube & Trivy | PowerShell Controller | ArgoCD v3.6.1 |
| **Namespace / Scope** | Local Engine Bridge | `task-manager` | Host & K8s cluster | Docker Network | `monitoring` | `logging` | Jenkins CI & Local | `task-manager` | `argocd` -> `task-manager` |
| **Frontend Access** | `http://localhost:8080` | `http://localhost:80` | Managed K8s Service | `http://localhost:8088` | Port-forward `:3001` | N/A (Internal daemon)| N/A | `http://localhost:80` | `http://localhost:80` |
| **Backend Access** | `http://localhost:3000` | Internal `backend-svc` | Managed K8s Service | `http://localhost:3001` | Port-forward `:9090` | N/A (Internal daemon)| `http://localhost:9000`| Internal `backend-svc` | Internal `backend-svc` |
| **Deployment Model** | Single container stack | Dual-replica Deploy | Automated Playbooks | Declarative containers| Single replica pods | Node DaemonSet | CI scanning & daemon | Parallel Blue & Green | Git-reconciled Deployments |
| **Traffic Routing** | Direct port bindings | Static Service selector| Managed manifests | Direct port bindings | Prometheus scrape jobs| Host log path tailing | N/A | Atomic selector switch | Ignored selector diffs |
| **Storage Strategy** | Ephemeral bind mounts | 1Gi `hostPath` PVC | K8s manifest deploy | Dedicated TF volume | ConfigMap volume mounts| Central `/var/log/fluentd`| Persistent named volumes| Shared PVC across colors | Excluded from GitOps |
| **Security Controls**| Non-root UIDs | Non-root `1001`/`101` | Sudo & Ansible Vault| Sensitive input vars | Pinned non-root UIDs | Least-privilege K8s RBAC| SAST, Trivy, No Defaults | Independent pods, no token| Encrypted ArgoCD admin secret|

---

## Operations & Verification Quick Reference

### 1. Local Development (Docker Compose)
```powershell
docker compose up -d --build
docker compose ps
docker compose logs -f
```

### 2. Full Kubernetes Deployment (Standard)
```powershell
powershell -ExecutionPolicy Bypass -File .\k8s\deploy.ps1
kubectl get pods,services,pvc -n task-manager
```

### 3. Blue-Green Traffic Cutover & Rollback
```powershell
# Inspect Blue-Green status
powershell -ExecutionPolicy Bypass -File .\k8s\blue-green.ps1 -Action status

# Deploy and switch to Green (v2.0.0-green)
powershell -ExecutionPolicy Bypass -File .\k8s\blue-green.ps1 -Action switch-green

# Roll back immediately to Blue (v1.0.1)
powershell -ExecutionPolicy Bypass -File .\k8s\blue-green.ps1 -Action rollback-blue
```

### 4. GitOps with ArgoCD
```powershell
# Deploy ArgoCD
powershell -ExecutionPolicy Bypass -File .\gitops\setup-argocd.ps1

# Forward ArgoCD UI (Port 8084)
kubectl port-forward svc/argocd-server 8084:443 -n argocd

# Inspect Application Sync State
kubectl get application task-manager-gitops -n argocd
```

### 5. Full Observability (Prometheus & Grafana)
```powershell
# Deploy monitoring stack
powershell -ExecutionPolicy Bypass -File .\monitoring\deploy.ps1

# Port-forward Grafana (Port 3001)
kubectl port-forward svc/grafana-service 3001:3000 -n monitoring

# Port-forward Prometheus (Port 9090)
kubectl port-forward svc/prometheus-service 9090:9090 -n monitoring
```

### 6. Centralized Logging (Fluentd)
```powershell
# Deploy Fluentd DaemonSet
powershell -ExecutionPolicy Bypass -File .\logging\deploy.ps1

# Inspect parsed application logs
kubectl exec -n logging ds/fluentd -- sh -c "tail -n 20 /var/log/fluentd-central/application/app.$(date +%Y%m%d).log"
```

### 7. Security & Code Quality (SonarQube)
```powershell
# Start SonarQube container
docker compose -f security/docker-compose.sonarqube.yml up -d

# Verify SonarQube health
curl.exe -s http://localhost:9000/api/system/status
```

---

## Conclusion & Capstone Assessment

The **Task Management System DevOps Capstone Project** has successfully achieved all architectural, automated, security, and operational objectives across all **11 phases**:

- **Continuous Integration (CI)**: Verified through 30 consecutive Jenkins builds, orchestrating multi-stage linting, unit testing, SonarQube static code analysis, hardened container building, Trivy CVE scanning, and artifact archiving.
- **Continuous Delivery & GitOps (CD)**: Verified through ArgoCD (`v3.6.1`) maintaining real-time declarative synchronization between Git (`origin/develop`) and Kubernetes with automated self-healing.
- **Zero-Downtime Deployment**: Proven via Kubernetes Blue-Green deployment architecture with atomic traffic cutovers, endpoint slice convergence validation, and automated rollback capabilities.
- **Infrastructure as Code & Configuration Management**: Automated through modular Terraform container definitions and hardened Ansible playbooks integrated safely with GitOps resource boundaries.
- **Full-Stack Observability & Logging**: Complete system visibility established via Prometheus metrics, an 8-panel Grafana dashboard, Metrics Server, and a Fluentd DaemonSet aggregating structured application and cluster logs.
- **Security & Least Privilege**: Enforced via multi-stage non-root container runtimes, clean Trivy vulnerability scans, SonarQube Quality Gate compliance, minimal Kubernetes RBAC roles, and zero hardcoded credentials across all manifests and scripts.

The entire codebase is clean, tested, documented, and fully synchronized on the `develop` branch of [https://github.com/Nik848/task-manager-devops](https://github.com/Nik848/task-manager-devops).
