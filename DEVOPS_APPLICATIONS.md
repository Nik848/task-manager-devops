# Complete DevOps Applications & Toolchain Guide
## Task Management System — End-to-End DevOps Architecture

This document provides a single, unified reference explaining **what each DevOps tool/application is doing**, **when it gets triggered**, and **how it works** under the hood across all 11 phases of the project.

---

## 1. Quick Reference: Application Trigger & Execution Matrix

| DevOps Application | What is it doing? | When is it triggered? | How is it working? | Key Ports / Endpoints |
| :--- | :--- | :--- | :--- | :--- |
| **1. Git & GitHub** | Source code management, version control, branching, PR reviews. | Whenever a developer writes code, commits, or pushes to GitHub. | Tracks delta commits across branches (`develop`, `main`, `feature/*`); hosts remote origin. | Remote GitHub Repository |
| **2. Jenkins CI** | Continuous Integration: automated lint, test, build, scan, package. | Automatically every 2 mins via SCM polling (`pollSCM`) on `develop`. | Runs inside Docker (DooD); mounts host Docker socket; executes 9-stage declarative `Jenkinsfile`. | `http://localhost:8085` |
| **3. SonarQube** | Static Application Security Testing (SAST) & Code Quality Gate. | Triggered by Jenkins in Stage 3 (`SonarQube Analysis`). | SonarScanner CLI scans JS/React code, transmits AST to SonarQube container on `:9000`, evaluates Quality Gate. | `http://localhost:9000` |
| **4. Trivy** | Container security scanning for vulnerabilities (CVEs). | Triggered by Jenkins in Stages 7 & 8 after Docker builds. | Scans container image rootfs and OS packages; fails build if `HIGH` or `CRITICAL` vulnerabilities exist. | Embedded CLI in Jenkins |
| **5. Docker & Compose** | Containerization & local multi-container development environment. | Run locally by developer via `docker compose up -d` or in CI. | Builds non-root multi-stage images (Node 20 Alpine & Nginx Alpine); bridges backend `:3000` and frontend `:8080`. | Frontend: `:8080`<br>Backend: `:3000` |
| **6. Kubernetes (K8s)** | Production container orchestration, scaling, self-healing, storage. | Workloads run continuously; updated on deployment or GitOps sync. | Schedules Pods across cluster; enforces dual replicas, liveness/readiness probes, and hostPath PVCs. | `docker-desktop`<br>Namespace: `task-manager` |
| **7. Blue-Green Script** | Zero-downtime production deployment and atomic traffic cutover. | Triggered manually by operator via `blue-green.ps1` during release. | Validates target pods readiness; atomically patches Service selector (`blue` ↔ `green`); auto-rollbacks on error. | Frontend: `http://localhost` (:80)<br>Backend: `:3000` |
| **8. ArgoCD (GitOps)** | Declarative Continuous Delivery and automated Git-to-cluster sync. | Runs continuously; polls Git every 3 minutes or upon webhook/refresh. | Reconciles `gitops/` manifests with cluster state; auto-prunes and self-heals drifts; ignores BG selector diffs. | UI: `https://localhost:8084`<br>Namespace: `argocd` |
| **9. Ansible** | Automated configuration management & server provisioning. | Triggered on-demand from Ubuntu WSL2 by systems operator. | Executes agentless idempotent YAML playbooks over SSH/local for Docker, K8s bootstrap, and manifest apply. | WSL2 / CLI |
| **10. Terraform** | Infrastructure as Code (IaC) for reproducible container environments. | Triggered on-demand by operator via `terraform apply` / `destroy`. | Declaratively plans and provisions isolated Docker networks, volumes, and containers using `kreuzwerker/docker`. | Backend: `:3001`<br>Frontend: `:8088` |
| **11. Prometheus** | Metrics scraping, time-series storage, and monitoring engine. | Runs continuously; scrapes targets every 15 seconds. | Pulls HTTP metrics from Node.js `/metrics`, `kube-state-metrics`, cAdvisor, and Prometheus itself. | UI: `http://localhost:9090`<br>Namespace: `monitoring` |
| **12. Kube-State-Metrics** | Cluster state exporter for Kubernetes object health and readiness. | Runs continuously; exposes pod/namespace metrics on port 8080. | Queries Kubernetes API server for pod readiness (`kube_pod_status_ready`) and cluster object states. | Internal `:8080` |
| **13. Metrics Server** | Lightweight container resource metrics provider for cluster. | Runs continuously in `kube-system`. | Collects CPU/memory metrics from Kubelet cAdvisor to power `kubectl top nodes` and `kubectl top pods`. | K8s internal API |
| **14. Grafana** | Unified observability dashboard and metrics visualization. | Runs continuously; accessed on-demand by operator/developer. | Queries Prometheus datasource via PromQL; renders 8-panel dashboard for CPU, RAM, throughput, latency, health. | UI: `http://localhost:3001`<br>Namespace: `monitoring` |
| **15. Fluentd** | Centralized logging agent for application and cluster logs. | Runs continuously as a Kubernetes DaemonSet on every node. | Tails container CRI logs from `/var/log/containers/*.log`, enriches with K8s metadata, parses Pino JSON, saves daily. | Storage: `/var/log/fluentd-central/` |
| **16. Supabase DB** | Managed cloud PostgreSQL relational database with SSL pooler. | Runs continuously in the cloud; queried by backend pods. | Stores users, tasks, and credentials over encrypted TLS connection; shared safely across Blue & Green pods. | Port 5432 / 6543 |

---

## 2. End-to-End Trigger Lifecycle & Data Flow

```text
  [ Developer Action ]
         │
         │  1. git commit & git push origin develop
         ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 1. Git & GitHub                                             │
  │    • Receives commit on 'develop' branch                     │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 │  2. SCM Polling detects commit (every 2 mins)
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 2. Jenkins CI Server (Port 8085)                            │
  │    • Stage 1: Checkout Git code                             │
  │    • Stage 2: Lint & syntax checks                          │
  │    • Stage 3: Trigger SonarQube SAST analysis               │
  │    • Stage 4: Run unit & integration tests                  │
  │    • Stage 5: Build React frontend & bundle release         │
  │    • Stage 6: Build hardened Docker images                  │
  │    • Stage 7 & 8: Scan images with Trivy for CVEs           │
  │    • Stage 9: Archive release artifacts                     │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
                 │ 3. Automated GitOps Sync      │ 4. Operator Release Switch
                 ▼                               ▼
  ┌─────────────────────────────┐ ┌─────────────────────────────┐
  │ 3. ArgoCD GitOps Engine     │ │ 4. Blue-Green Script        │
  │    (Port 8084)              │ │    (k8s/blue-green.ps1)     │
  │ • Monitors gitops/ folder   │ │ • Pre-flight health check   │
  │ • Applies desired K8s state │ │ • Atomically switches       │
  │ • Prunes & self-heals       │ │   Service selector          │
  │ • Ignores BG selector diffs │ │ • Rolls back if health fails│
  └──────────────┬──────────────┘ └──────────────┬──────────────┘
                 │                               │
                 └───────────────┬───────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 5. Kubernetes Production Cluster (docker-desktop)           │
  │    • Namespace 'task-manager':                              │
  │      - backend-blue / frontend-blue (Active v1.0.1)         │
  │      - backend-green / frontend-green (Staged v2.0.0-green) │
  │      - backend-service (ClusterIP :3000)                    │
  │      - frontend-service (LoadBalancer :80)                  │
  │      - ConfigMap, Secret, 1Gi hostPath PVC                  │
  │    • Connects to Cloud PostgreSQL (Supabase) via SSL        │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │ Continuous Scraping           │ Continuous Log Tailing
                 ▼                               ▼
  ┌─────────────────────────────┐ ┌─────────────────────────────┐
  │ 6. Observability Stack      │ │ 7. Centralized Logging      │
  │    (Namespace: monitoring)  │ │    (Namespace: logging)     │
  │ • Prometheus (:9090):       │ │ • Fluentd DaemonSet:        │
  │   Scrapes metrics every 15s │ │   Tails /var/log/pods/      │
  │ • kube-state-metrics (:8080)│ │ • Filters & parses Pino JSON│
  │ • Metrics Server (cAdvisor) │ │ • Flushes daily log files to│
  │ • Grafana (:3001):          │ │   /var/log/fluentd-central/ │
  │   Renders live 8-panel dash │ │                             │
  └─────────────────────────────┘ └─────────────────────────────┘
                                 │
                                 ▼
                      ┌──────────────────────┐
                      │ 8. End User Access   │
                      │    http://localhost  │
                      └──────────────────────┘
```

---

## 3. Deep-Dive: Each DevOps Application Explained

---

### 1. Git & GitHub (Phase 1)

#### What is it doing?
- Acts as the central **Version Control System (VCS)** and source of truth for all source code, Dockerfiles, Kubernetes manifests, Ansible playbooks, and documentation.
- Enforces collaborative engineering standards through the **GitFlow** branching strategy (`main`, `develop`, `feature/*`), pull request code reviews, and commit conventions.

#### When is it getting triggered?
- Triggered manually whenever a developer commits code (`git commit`) and pushes to the remote GitHub repository (`git push origin <branch>`).

#### How is it working?
- Uses distributed Git trees to track line-by-line file diffs.
- `main` holds production-ready releases.
- `develop` serves as the continuous integration baseline where all features converge.
- Pull requests enforce peer reviews and automated checks before merging into `develop`.

---

### 2. Jenkins CI Server (Phase 2)

#### What is it doing?
- Serves as the automated **Continuous Integration (CI) Engine**.
- Executes the entire testing, static analysis, compiling, container building, vulnerability scanning, and packaging pipeline without manual developer intervention.

#### When is it getting triggered?
- **Automatic SCM Polling**: Configured with `pollSCM('H/2 * * * *')`, meaning Jenkins polls GitHub every 2 minutes. If a new commit hash is detected on `origin/develop`, the pipeline starts automatically.
- Can also be triggered manually by clicking **"Build Now"** in the Jenkins UI.

#### How is it working?
- Runs inside an isolated Docker container (`jenkins-devops`) mapped to host port **`8085`** (`jenkins/setup-jenkins.ps1`).
- Uses **Docker-outside-of-Docker (DooD)**: mounts `/var/run/docker.sock` from the Windows host with appropriate group permissions (`group_add`), allowing the Jenkins container to run Docker commands natively on the host engine.
- Executes the declarative [Jenkinsfile](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/Jenkinsfile) containing 9 discrete stages:
  1. **Checkout**: Clones the repo and records Git commit SHA.
  2. **Lint & Code Quality**: Runs `npm ci` and Node.js syntax checks.
  3. **SonarQube Analysis**: Runs static code analysis via SonarScanner.
  4. **Unit & Integration Tests**: Runs backend automated test suites.
  5. **Build & Package**: Builds optimized React Vite static assets and tars release bundles.
  6. **Docker Build**: Compiles Docker images for backend and frontend.
  7. **Trivy Scan Backend**: Scans backend image for High/Critical CVEs.
  8. **Trivy Scan Frontend**: Scans frontend image for High/Critical CVEs.
  9. **Archive Artifacts**: Stores tarballs in Jenkins build history.

---

### 3. SonarQube (Phase 9)

#### What is it doing?
- Performs **Static Application Security Testing (SAST)** and code quality auditing.
- Scans source code for security vulnerabilities, code smells, syntax bugs, and maintainability issues, enforcing a **Quality Gate**.

#### When is it getting triggered?
- Triggered automatically by **Jenkins during Stage 3 (`SonarQube Analysis`)** of the CI pipeline on every build.

#### How is it working?
- Runs as an independent container (`sonarqube-devops`) on port **`9000`** using [security/docker-compose.sonarqube.yml](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/security/docker-compose.sonarqube.yml).
- Jenkins authenticates via an encrypted token (`sonarqube-token`) stored in Jenkins Credentials and injected via `withCredentials`.
- SonarScanner CLI parses the JavaScript/React source tree into Abstract Syntax Trees (ASTs), checks against standard rule profiles, and posts results to `http://host.docker.internal:9000`.
- Memory is safely capped with `-Dsonar.javascript.node.maxspace=512` to prevent JavaScript heap exhaustion.

---

### 4. Trivy (Phase 9)

#### What is it doing?
- Acts as the automated **Container Image Security & Vulnerability Scanner**.
- Inspects container image layers, Alpine OS packages, and Node.js dependencies for known Common Vulnerabilities and Exposures (CVEs).

#### When is it getting triggered?
- Triggered automatically by **Jenkins during Stages 7 and 8** of the CI pipeline immediately after Docker images are built.

#### How is it working?
- Runs inside the Jenkins container using the Trivy CLI:
  ```bash
  trivy image --exit-code 1 --severity HIGH,CRITICAL taskmanager-backend:$BUILD_NUMBER
  ```
- If any `HIGH` or `CRITICAL` severity vulnerability is detected without a patch, Trivy exits with return code `1`, causing Jenkins to fail the build immediately and block broken images from reaching production.

---

### 5. Docker & Docker Compose (Phase 3)

#### What is it doing?
- **Docker**: Packages the application into lightweight, reproducible, immutable container images containing code, runtime, libraries, and reverse proxy settings.
- **Docker Compose**: Orchestrates multi-container local environments (`taskmanager-backend` on port `3000` and `taskmanager-frontend` on port `8080`) connected via bridge network `taskmanager-network`.

#### When is it getting triggered?
- **Locally**: Triggered manually by developer running `docker compose up -d --build`.
- **In CI**: Triggered by Jenkins in Stage 6 to build production images.

#### How is it working?
- **Backend Dockerfile**: Multi-stage build on `node:20.20.2-alpine3.23`. Drops root privileges to unprivileged system user `taskapp` (UID `1001`). Strips developer tools. Probes health via HTTP `GET /health` every 10s.
- **Frontend Dockerfile**: Multi-stage build. Builds React Vite SPA into static HTML/JS/CSS assets and serves them via unprivileged `nginx:1.27.5-alpine` (UID `101`). Nginx reverse-proxies `/api/` and `/health` requests to `backend:3000`.

---

### 6. Kubernetes (K8s) (Phase 4)

#### What is it doing?
- Acts as the production-grade **Container Orchestration Platform**.
- Automates container scheduling, dual-replica replication, health monitoring (liveness/readiness), load balancing, zero-downtime rolling updates, automated rollbacks, and persistent storage management.

#### When is it getting triggered?
- Runs continuously as a background cluster service on Docker Desktop (`docker-desktop` context).
- Changes are applied when:
  1. Running the deployment script: `powershell .\k8s\deploy.ps1`.
  2. ArgoCD synchronizes desired state from Git.
  3. A pod crashes or is terminated (Kubernetes automatically restarts or reschedules it).

#### How is it working?
- Deployed within dedicated namespace `task-manager` using manifests in [k8s/](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/k8s/):
  - **Deployments**: Maintains 2 replicas each for `backend` and `frontend`.
  - **Services**: `frontend-service` exposes port `80` externally via LoadBalancer; `backend-service` routes internal cluster traffic on port `3000` via ClusterIP.
  - **ConfigMap & Secret**: Injects environment variables (`PORT`, `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`).
  - **PV & PVC**: Allocates 1Gi `hostPath` persistent volume mounted at `/app/logs` with an `initContainer` aligning non-root ownership.

---

### 7. Blue-Green Deployment Controller (Phase 10)

#### What is it doing?
- Implements a **Zero-Downtime Deployment Strategy** on Kubernetes.
- Runs two identical production environments side-by-side: **Blue** (active, currently taking live traffic) and **Green** (idle or staging target for new releases).
- Allows instant rollback in `< 2` seconds without terminating working containers.

#### When is it getting triggered?
- Triggered on-demand by the deployment operator via [k8s/blue-green.ps1](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/k8s/blue-green.ps1):
  - `.\k8s\blue-green.ps1 -Action status`
  - `.\k8s\blue-green.ps1 -Action switch-green`
  - `.\k8s\blue-green.ps1 -Action rollback-blue`

#### How is it working?
- **Deployments**: `backend-blue` / `frontend-blue` (`v1.0.1`) and `backend-green` / `frontend-green` (`v2.0.0-green`) coexist in namespace `task-manager`.
- **Pre-Flight Health Probes**: Before switching, the script uses temporary port-forwarding to probe the target environment's `/health` endpoint out-of-band.
- **Atomic Selector Patching**: Updates `spec.selector.version` on both `frontend-service` and `backend-service` in a single command.
- **Convergence Check**: Monitors `discovery.k8s.io/v1 EndpointSlices` until network traffic has fully shifted to target pods.
- **Auto-Rollback**: If health checks fail during cutover, the script immediately reverts both Services back to the original selector.

---

### 8. ArgoCD — Declarative GitOps (Phase 11)

#### What is it doing?
- Acts as the automated **GitOps Continuous Delivery (CD) Controller**.
- Treats Git repository directory `gitops/` on branch `develop` as the single authoritative source of truth for cluster state, automatically eliminating configuration drift.

#### When is it getting triggered?
- Runs continuously as a daemon in namespace `argocd`.
- Automatically polls GitHub every 3 minutes.
- Can be triggered immediately via Webhook or manual UI/CLI hard-refresh:
  ```powershell
  kubectl annotate application task-manager-gitops -n argocd argocd.argoproj.io/refresh=hard --overwrite
  ```

#### How is it working?
- Pinned release **`v3.6.1`** installed in namespace `argocd` (`gitops/setup-argocd.ps1`).
- The `Application` CR ([gitops/application.yaml](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/gitops/application.yaml)) monitors `gitops/manifests/` on branch `develop`.
- **Self-Healing & Prune**: If a cluster resource is accidentally altered or deleted, ArgoCD automatically reapplies the Git manifest to restore state.
- **Blue-Green Compatibility**: Configured with `ignoreDifferences` on `/spec/selector` for `frontend-service` and `backend-service`, ensuring ArgoCD does not undo live Blue-Green traffic switches performed by `blue-green.ps1`.
- **Security**: Sensitive secrets and PVCs are excluded from Git to prevent credential exposure or storage purging.

---

### 9. Ansible (Phase 5)

#### What is it doing?
- Provides agentless **Automated Configuration Management & Server Provisioning**.
- Automates installing software prerequisites (Docker, containerd, Kubernetes packages) and applying application manifests across Linux hosts or WSL2.

#### When is it getting triggered?
- Triggered manually on-demand from Ubuntu on WSL2 by an operator executing:
  ```bash
  ansible-playbook -i inventory/hosts.ini playbooks/<playbook_name>.yml
  ```

#### How is it working?
- Connects over SSH or local connection using playbooks in [ansible/playbooks/](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/ansible/playbooks/):
  - `install_docker.yml`: Validates Linux OS, adds official Docker apt repository, installs Docker Engine and containerd.
  - `install_kubernetes.yml`: Configures containerd `SystemdCgroup = true` and installs pinned Kubernetes `v1.30` packages (`kubeadm`, `kubelet`, `kubectl`).
  - `deploy_application.yml`: Applies Kubernetes manifests with rollout verification.
  - `configure_application.yml`: Updates ConfigMaps and triggers rolling restarts only upon detected diffs.
- **Fail-Safe GitOps Deference**: Checks if ArgoCD's `task-manager-gitops` Application is active; if found, Ansible safely skips applying ConfigMaps and RBAC to prevent overwriting GitOps state.

---

### 10. Terraform (Phase 6)

#### What is it doing?
- Provides **Infrastructure as Code (IaC)** for managing container infrastructure declaratively.
- Plans, creates, and destroys isolated container instances, networks, and storage volumes in a repeatable, version-controlled manner.

#### When is it getting triggered?
- Triggered manually on-demand by an operator from [terraform/](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/terraform/):
  ```bash
  terraform init
  terraform plan
  terraform apply
  terraform destroy
  ```

#### How is it working?
- Uses the `kreuzwerker/docker` provider (`~> 3.0.2`).
- Modular structure:
  - `main.tf`: Root module creating bridge network `taskmanager-tf-network` and volume `taskmanager-tf-logs`.
  - `modules/docker_container`: Reusable module provisioning backend (mapped to host port **`3001`**) and frontend (mapped to host port **`8088`**) without port collisions with Kubernetes or Compose.
- **Secret Hygiene**: Declares sensitive variables (`sensitive = true`) and excludes `.tfstate` files in `.gitignore` to prevent secret commits.

---

### 11. Prometheus (Phase 7)

#### What is it doing?
- Acts as the core **Metrics Scraper & Time-Series Database**.
- Continuously collects real-time operational and performance metrics across the entire application and cluster stack.

#### When is it getting triggered?
- Runs continuously as a Kubernetes Deployment in namespace `monitoring`.
- Automatically scrapes all configured HTTP target endpoints **every 15 seconds** based on `scrape_interval: 15s`.

#### How is it working?
- Configured via [monitoring/prometheus/configmap.yaml](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/monitoring/prometheus/configmap.yaml).
- Scrapes 4 distinct targets:
  1. `task-manager-backend`: Scrapes Node.js Express `/metrics` endpoint using `prom-client` (request count, HTTP latency histograms, heap memory, event loop lag).
  2. `kube-state-metrics`: Collects pod readiness status and container restart counts.
  3. `kubernetes-cadvisor`: Collects raw CPU and memory cgroup usage per container.
  4. `prometheus`: Scrapes Prometheus internal engine health.
- Web UI accessible via port-forward on `http://localhost:9090`.

---

### 12. kube-state-metrics & Metrics Server (Phase 7)

#### What is it doing?
- **kube-state-metrics**: Listens to the Kubernetes API server and generates metrics about the health and state of cluster objects (deployments, pods, nodes).
- **Metrics Server**: Collects container resource metrics (CPU/RAM) from Kubelet cAdvisor to power `kubectl top nodes` and `kubectl top pods`.

#### When is it getting triggered?
- Both run continuously as cluster background workloads.
- **kube-state-metrics**: Scraped by Prometheus every 15 seconds on internal port `8080`.
- **Metrics Server**: Polled by Kubernetes API server whenever `kubectl top` is executed.

#### How is it working?
- **kube-state-metrics** runs with a read-only ClusterRole accessing `pods` and `namespaces`. Emits `kube_pod_status_ready`, allowing Grafana to verify all application pods are ready to serve live traffic.
- **Metrics Server** communicates with the Kubelet API over TLS using `--kubelet-insecure-tls` for local Docker Desktop support.

---

### 13. Grafana (Phase 7)

#### What is it doing?
- Acts as the **Central Observability Visualization Dashboard**.
- Translates raw time-series metrics from Prometheus into human-readable visual dashboards with charts, gauges, and status counters.

#### When is it getting triggered?
- Runs continuously as a Deployment in namespace `monitoring`.
- Renders visual dashboards whenever a user opens the web browser at [http://localhost:3001](http://localhost:3001).

#### How is it working?
- Deployed with auto-provisioned Prometheus datasource ([monitoring/grafana/configmap-datasources.yaml](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/monitoring/grafana/configmap-datasources.yaml)).
- Pre-loads standalone dashboard JSON [monitoring/dashboards/dashboard-task-manager.json](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/monitoring/dashboards/dashboard-task-manager.json) via file provider.
- Displays an **8-panel operations dashboard**:
  1. *Backend Metrics Endpoint Scrape Status* (`up`)
  2. *Application Pod Readiness* (`kube_pod_status_ready`)
  3. *Backend HTTP Request Rate* (`http_requests_total`)
  4. *HTTP Request Latency Avg & p95* (`http_request_duration_seconds_bucket`)
  5. *Backend Process CPU Usage* (`process_cpu_seconds_total`)
  6. *Backend Process Memory Usage* (`process_resident_memory_bytes`, heap stats)
  7. *Pod Container CPU Usage* (`container_cpu_usage_seconds_total`)
  8. *Pod Container Memory Usage* (`container_memory_working_set_bytes`)
- **Security**: Mandatory admin password injected dynamically at deploy time via `$env:GRAFANA_ADMIN_PASSWORD` into Secret `grafana-secret` with zero hardcoded defaults.

---

### 14. Fluentd (Phase 8)

#### What is it doing?
- Acts as the **Centralized Log Collection & Parsing Agent**.
- Aggregates container stdout/stderr log streams from all Kubernetes pods, parses application JSON logs, enriches them with cluster metadata, and writes them to durable centralized storage.

#### When is it getting triggered?
- Runs continuously as a Kubernetes **DaemonSet** (`fluentd`) across all cluster nodes.
- Continuously streams log records in real time as containers produce `stdout` and `stderr` output.

#### How is it working?
- Runs the official upstream image `fluent/fluentd-kubernetes-daemonset:v1.17-debian-forward-1` in namespace `logging`.
- Tailing source: Tails containerd CRI log files on the host node (`/var/log/containers/*.log` which resolve to `/var/log/pods/...`). Excludes Fluentd's own logs to prevent ingestion loops.
- **Enrichment**: Uses `fluent-plugin-kubernetes_metadata_filter` via a read-only ServiceAccount to attach `namespace_name`, `pod_name`, `container_name`, and labels.
- **JSON Parsing**: Passes application logs from namespace `task-manager` through `@type parser` / `format json`, parsing Pino structured log fields (`level`, `time`, `msg`, `reqId`, `status_code`).
- **Storage**: Flushes records every 5 seconds into daily time-sliced files on persistent host storage:
  - Application logs: `/var/log/fluentd-central/application/app.YYYYMMDD.log`
  - Infrastructure logs: `/var/log/fluentd-central/infrastructure/infra.YYYYMMDD.log`

---

### 15. Supabase PostgreSQL Database

#### What is it doing?
- Acts as the persistent **Relational Database** for the Task Management System.
- Stores user accounts (hashed passwords via bcryptjs), authentication tokens, task items, priorities, and completion statuses.

#### When is it getting triggered?
- Runs continuously as an external cloud-managed DBaaS.
- Queried by backend pods whenever an API request requires authentication (`/api/auth/*`) or CRUD operations (`/api/tasks/*`).

#### How is it working?
- Hosted in the cloud by Supabase using a PostgreSQL connection pooler over port `5432` / `6543`.
- Backend connects securely using Drizzle ORM over an encrypted SSL link (`sslmode=require`), injected via Kubernetes Secret `task-manager-secret` (`DATABASE_URL`).
- Because it is hosted externally, both Blue and Green Kubernetes deployments share the same database instance without requiring local state synchronization.

---

## 4. How to Verify All DevOps Applications Are Healthy

Run this single PowerShell command block to verify every tool in the pipeline:

```powershell
# 1. Check Kubernetes Pods across all namespaces (App, GitOps, Monitoring, Logging)
kubectl get pods -A

# 2. Check running Docker Containers (Jenkins CI, SonarQube, Compose)
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 3. Check Blue-Green traffic routing status
powershell -ExecutionPolicy Bypass -File .\k8s\blue-green.ps1 -Action status

# 4. Check ArgoCD GitOps sync status
kubectl get application task-manager-gitops -n argocd

# 5. Check live application endpoints
curl.exe -I http://localhost/health
curl.exe -I http://localhost:3000/health
```
