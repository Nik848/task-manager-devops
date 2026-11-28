# Task Management System — DevOps Capstone Technical Report
## Course: DevOps & Automation Lab (ENSP461) — B. Tech CSE Semester VII

**Project Title:** Design and Implementation of an End-to-End DevOps Pipeline for Cloud-Native Application Deployment  
**Repository:** `https://github.com/Nik848/task-manager-devops`  
**Target Branch:** `develop` & `main`  
**Execution Environment:** Windows 11 Host, Docker Desktop (Kubernetes `docker-desktop`), Ubuntu on WSL2  
**Database:** Cloud-Managed PostgreSQL (Supabase) via SSL Pooler  
**Latest Verified Commit:** `c87e07d` (`fix(ansible): defer RBAC to ArgoCD and fail safely on cluster errors`)  
**CI/CD Pipeline Status:** Jenkins Build #30 — **SUCCESS**  
**GitOps Status:** ArgoCD Application `task-manager-gitops` — **Synced & Healthy**

---

## 1. Problem Statement

Modern software organizations require web applications to be delivered rapidly, securely, and reliably. Manual deployment processes are slow, error-prone, and difficult to scale across environments. Developers frequently face the *"it worked on my machine"* dilemma due to runtime discrepancies, missing dependencies, and configuration drift between development laptops and target environments. Furthermore, manual infrastructure setup, lack of continuous automated testing, unmonitored container workloads, and risky downtime-heavy production releases increase operational risk and vulnerability exposure.

To address these challenges, this capstone project designs, implements, and demonstrates a complete, automated, industry-standard DevOps and GitOps pipeline for a full-stack, cloud-native **Task Management System**.

---

## 2. Project Objectives

The primary objective is to implement an automated software delivery workflow fulfilling all course outcomes (CO1–CO5) and laboratory requirements:

1. **Version Control (Git & GitHub)**: Implement professional collaborative workflows adhering to GitFlow (`main`, `develop`, feature branches), conflict resolution, and peer-review policies.
2. **Continuous Integration (Jenkins)**: Automate build, test, and artifact packaging triggered via SCM polling upon developer push.
3. **Containerization (Docker & Compose)**: Containerize full-stack services using secure, multi-stage, non-root Dockerfiles and local multi-container orchestration via Docker Compose.
4. **Kubernetes Orchestration**: Declaratively deploy workloads into dedicated namespaces with automated self-healing, rolling updates, scaling, rollbacks, and persistent volume storage.
5. **Infrastructure as Code & Configuration Automation**: Automate server provisioning and configuration using Ansible playbooks and reproducible Terraform modules.
6. **Full-Stack Observability (Prometheus & Grafana)**: Collect real-time application, container, and cluster metrics without hardcoded secrets.
7. **Centralized Logging (Fluentd)**: Aggregate and parse structured application (Pino JSON) and infrastructure logs using a Kubernetes DaemonSet into centralized storage.
8. **DevSecOps & Security**: Integrate SonarQube static code quality gates, Trivy container vulnerability scanning in CI, least-privilege Kubernetes RBAC, and secure secret segregation.
9. **Zero-Downtime Deployment (Blue-Green)**: Eliminate deployment downtime through parallel versioned environments with atomic traffic cutover and instant rollback.
10. **Declarative GitOps (ArgoCD)**: Maintain Git as the single source of truth for cluster state with automated reconciliation and drift self-healing.

---

## 3. Architecture & End-to-End Pipeline

### 3.1 Standard Pipeline Flow Diagram
As specified in the official capstone laboratory requirements:

```text
  ┌──────────────┐
  │  Developer   │ (Git commit & push)
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │    GitHub    │ (origin/develop & origin/main)
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │   Jenkins    │ (Automated CI: Lint -> SonarQube -> Test -> Build -> Trivy -> Package)
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │    Docker    │ (Hardened, non-root multi-stage container images)
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  Kubernetes  │ (docker-desktop: Deployments, Services, ConfigMaps, Secrets, PV/PVC)
  └──────┬───────┘
         │
         ├────────────────────────────────────────┐
         ▼                                        ▼
  ┌──────────────┐                         ┌──────────────┐
  │  Monitoring  │ (Prometheus & Grafana)  │   Logging    │ (Fluentd DaemonSet)
  └──────┬───────┘                         └──────┬───────┘
         │                                        │
         └───────────────────┬────────────────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │   End User   │ (Web Browser: http://localhost)
                      └──────────────┘
```

### 3.2 Detailed System Topology Diagram

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
                                           │  • Continuous Sync (Git)  │
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

## 4. Tools Used

| Tool / Technology | Version / Base Image | Category / Phase | Purpose in Project |
| :--- | :--- | :--- | :--- |
| **Git & GitHub** | Git 2.40+ | Version Control (Phase 1) | Monorepo source management, branching model, pull requests |
| **Jenkins** | `jenkins/jenkins:lts` | Continuous Integration (Phase 2) | Declarative automated pipeline (checkout, test, build, scan, package) |
| **Docker & Compose**| Docker Desktop 26+ | Containerization (Phase 3) | Multi-stage image packaging, local multi-container stack |
| **Kubernetes** | v1.30.0 (docker-desktop) | Container Orchestration (Phase 4) | Dual-replica deployments, health probes, rolling updates, PVC storage |
| **Ansible** | Ansible 2.16+ (WSL2) | Configuration Management (Phase 5) | Playbooks for engine bootstrap, Kubernetes setup, and app deployment |
| **Terraform** | Terraform 1.5+ | Infrastructure as Code (Phase 6) | Declarative container provisioning with modular reusable architecture |
| **Prometheus** | `prom/prometheus:v2.51.0` | Metrics Observability (Phase 7) | Time-series scraper for Node.js `/metrics`, cAdvisor, and Kube State |
| **Grafana** | `grafana/grafana:10.4.0` | Metrics Visualization (Phase 7) | 8-panel live dashboard displaying CPU, RAM, throughput, and latency |
| **kube-state-metrics**| `v2.12.0` | Cluster State Metrics (Phase 7) | Exposes pod readiness and Kubernetes object health to Prometheus |
| **Fluentd** | `v1.17-debian-forward-1` | Centralized Logging (Phase 8) | DaemonSet collecting CRI container logs into `/var/log/fluentd-central/` |
| **SonarQube** | `25.12.0-community` | DevSecOps / SAST (Phase 9) | Automated static analysis and Quality Gate enforcement |
| **Trivy** | Aquasecurity Trivy | DevSecOps / Scanning (Phase 9) | Container image vulnerability auditing for High/Critical CVEs |
| **PowerShell** | PowerShell 7 / Windows PS| Deployment Strategy (Phase 10) | Automated Blue-Green deployment, readiness checks, and rollback |
| **ArgoCD** | `v3.6.1` | GitOps Delivery (Phase 11) | Declarative Git-driven cluster synchronization and self-healing |
| **Supabase** | Cloud PostgreSQL | Database Layer | Managed relational PostgreSQL accessed over secure SSL pooler |

---

## 5. Phase-by-Phase Implementation & Verification

### Phase 1: Version Control & Collaborative Git Workflows
- **Implementation**: Created full monorepo structure housing Express backend (`app/backend`) and React frontend (`app/frontend`). Configured GitFlow branching model (`main` for production releases, `develop` for active integration, and `feature/*` branches).
- **Collaboration & Standards**: Authored [CONTRIBUTING.md](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/CONTRIBUTING.md) detailing branch naming, mandatory peer-review standards, commit message formats (`feat:`, `fix:`, `docs:`, `ci:`), and zero-credential-leak security policies.
- **Verification**: Verified branch creation, merge conflict resolution, clean fast-forwards, and complete commit history on GitHub.

### Phase 2: Continuous Integration with Jenkins
- **Implementation**: Deployed containerized Jenkins server via Docker-outside-of-Docker (DooD), mounting the host Docker socket (`/var/run/docker.sock`) into Jenkins on host port **`8085`** (`jenkins/setup-jenkins.ps1`).
- **Declarative Pipeline (`Jenkinsfile`)**: Configured SCM polling (`pollSCM('H/2 * * * *')`) to automatically trigger builds on Git pushes. Structured pipeline stages:
  1. *Checkout*: Clones branch and records Git commit SHA.
  2. *Lint & Code Quality*: Runs `npm ci` and syntax checks across backend files.
  3. *Unit & Integration Tests*: Runs automated Jest tests validating API endpoints.
  4. *Build & Package*: Compiles React Vite SPA and creates tarball distribution artifacts in `release/`.
  5. *Archive Artifacts*: Stores build bundles in Jenkins build history.
- **Verification**: Over 30 consecutive builds executed automatically, achieving **`SUCCESS`** status.

### Phase 3: Docker Containerization & Docker Compose
- **Backend Dockerfile (`app/backend/Dockerfile`)**: Multi-stage build on `node:20.20.2-alpine3.23`. Drops root to unprivileged system user `taskapp` (UID `1001`). Strips developer tools. Includes HTTP healthcheck probe.
- **Frontend Dockerfile (`app/frontend/Dockerfile`)**: Multi-stage build. Builds React static assets with Vite and serves them via `nginx:1.27.5-alpine` running as unprivileged user `nginx` (UID `101`). Nginx reverse-proxies `/api/` and `/health` requests to `backend:3000`.
- **Docker Compose (`docker-compose.yml`)**: Orchestrates backend (`:3000`) and frontend (`:8080`) over isolated bridge network `taskmanager-network`, connecting securely to Supabase PostgreSQL over SSL.
- **Verification**: `docker compose up -d` brings both services to `Up (healthy)`. Full user signup, login, and task CRUD verified via browser at `http://localhost:8080`.

### Phase 4: Kubernetes Orchestration & Cluster Management
- **Manifest Architecture (`k8s/`)**:
  - `namespace.yaml`: Creates isolated namespace `task-manager`.
  - `configmap.yaml` & `secret.yaml`: Injects application configuration and database credentials.
  - `backend-deployment.yaml` & `frontend-deployment.yaml`: Dual replicas, non-root security contexts, liveness/readiness probes, and resource requests/limits.
  - `backend-service.yaml` (ClusterIP `:3000`) & `frontend-service.yaml` (LoadBalancer `:80`).
  - `task-manager-pv.yaml` & `task-manager-pvc.yaml`: 1Gi `hostPath` persistent volume mounted at `/app/logs` with non-root permission initContainer.
- **Orchestration Demonstration**:
  - *Scaling*: Scaled backend from 2 to 4 replicas (`kubectl scale deployment/backend --replicas=4`). Confirmed load balancing across 4 pods.
  - *Rolling Update*: Updated backend image to `v1.0.1` (`kubectl set image deployment/backend`). Verified zero-downtime rolling update.
  - *Rollback*: Reverted release via `kubectl rollout undo deployment/backend`.
  - *Persistence*: Wrote test file to `/app/logs` in Pod A, deleted Pod A, and verified replacement Pod B successfully read the file from the PVC.

### Phase 5: Ansible Automation & Configuration Management
- **Implementation**: Authored 4 production playbooks in `ansible/playbooks/` executed from Ubuntu on WSL2:
  - `install_docker.yml`: Automated preflight Linux assertions, repository setup, and containerd runtime installation.
  - `install_kubernetes.yml`: Configures containerd `SystemdCgroup = true` and installs pinned Kubernetes `v1.30` packages.
  - `deploy_application.yml`: Declaratively applies Kubernetes manifests with rollout verification.
  - `configure_application.yml`: Idempotently updates ConfigMaps and triggers rolling restarts only upon detected diffs.
- **GitOps Deference**: Integrated fail-safe cluster queries to safely defer ConfigMap and RBAC updates when ArgoCD is detected, preventing configuration drift.

### Phase 6: Infrastructure as Code (IaC) with Terraform
- **Implementation (`terraform/`)**: Reusable modular architecture using `kreuzwerker/docker` provider:
  - Root module (`main.tf`, `variables.tf`, `outputs.tf`) managing isolated bridge network `taskmanager-tf-network` and volume `taskmanager-tf-logs`.
  - Child module (`modules/docker_container`) parameterized for reusable container provisioning.
  - Runs isolated container instances on alternate host ports (`:3001` backend, `:8088` frontend) without port collisions.
- **Security**: Sensitive variable declarations (`sensitive = true`) and strict `.gitignore` rules preventing `.tfstate` credential commits.
- **Verification**: Complete lifecycle verified via `terraform init`, `terraform plan`, `terraform apply`, and `terraform destroy`.

### Phase 7: Full-Stack Observability with Prometheus & Grafana
- **Metrics Infrastructure (`monitoring/`)**:
  - Deployed in dedicated namespace `monitoring` via [monitoring/deploy.ps1](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/monitoring/deploy.ps1).
  - Enforces `$env:GRAFANA_ADMIN_PASSWORD` validation at deploy time, dynamically generating `grafana-secret` without credential leakage.
  - Prometheus (`:9090` ClusterIP) scrapes Express `/metrics` (`prom-client`), Node.js runtime metrics, `kube-state-metrics` (`:8080`), and Kubelet cAdvisor.
  - Metrics Server provides container CPU/RAM metrics for `kubectl top`.
- **Grafana Dashboard (`task-manager-overview`)**:
  - Auto-provisioned 8-panel dashboard visualizing backend scrape status, pod readiness, request rate, p95 latency, Node.js event loop CPU, heap memory, and container cgroup utilization.
- **Verification**: Prometheus `/api/v1/targets` confirms 4/4 scrape jobs `UP`. Grafana dashboard accessible on `http://localhost:3001`.

### Phase 8: Centralized Logging with Fluentd
- **Logging Pipeline (`logging/`)**:
  - Deployed in dedicated namespace `logging` via [logging/deploy.ps1](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/logging/deploy.ps1).
  - Fluentd DaemonSet (`fluent/fluentd-kubernetes-daemonset:v1.17-debian-forward-1`) tails host containerd CRI logs from `/var/log/containers/*.log`.
  - Kubernetes metadata plugin attaches pod name, namespace, and container metadata via a read-only ServiceAccount.
  - Filter plugin parses Pino JSON structured application logs from `task-manager`, mapping numeric levels to descriptive strings.
  - Output plugin writes structured daily time-sliced JSON logs to centralized persistent host storage:
    - Application logs: `/var/log/fluentd-central/application/app.YYYYMMDD.log`
    - Infrastructure logs: `/var/log/fluentd-central/infrastructure/infra.YYYYMMDD.log`
- **Verification**: Validated DaemonSet readiness across nodes. Inspected `/var/log/fluentd-central/application/` confirming real-time collection of application HTTP request logs.

### Phase 9: Comprehensive Security Implementation (DevSecOps)
- **SonarQube SAST**: Pinned `sonarqube:25.12.0-community` running on `http://localhost:9000`. Analyzes JavaScript/React codebases via SonarScanner CLI with memory-capped Node.js bridge. Integrated with Jenkins Credentials (`sonarqube-token`). Quality Gate: **PASSED** (0 Bugs, 0 Vulnerabilities, 0 Security Hotspots).
- **Trivy Container Scanning**: Integrated automated Trivy vulnerability scanning into `Jenkinsfile` for backend and frontend images, enforcing `--exit-code 1 --severity HIGH,CRITICAL`.
- **Image Hardening**: Pinned Alpine base images, executed `apk upgrade --no-cache`, stripped unnecessary build tools (`npm`, `corepack`), and upgraded `drizzle-orm` to `^0.45.2` resolving `CVE-2026-39356`.
- **Kubernetes RBAC**: Restricted `task-manager-operator` to namespace-scoped read/deploy permissions with zero `secrets` access. Application pods configured with `automountServiceAccountToken: false`. Removed all predictable admin credential defaults from deployment scripts.

### Phase 10: Blue-Green Deployment Strategy
- **Architecture (`k8s/blue-green/`)**:
  - Parallel deployments: `backend-blue`/`frontend-blue` (`v1.0.1`) and `backend-green`/`frontend-green` (`v2.0.0-green`).
  - Shared configuration, secrets, PVC, and Supabase PostgreSQL instance.
  - LoadBalancer `frontend-service` (`:80`) and ClusterIP `backend-service` (`:3000`) dynamically select active environment via `version: blue|green`.
- **Controller Automation ([k8s/blue-green.ps1](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/k8s/blue-green.ps1))**:
  - `status`: Displays replica counts, image tags, readiness, and active selectors.
  - `deploy-green`: Deploys Green manifests and performs pre-flight readiness probes via temporary port-forwarding.
  - `switch-green`: Validates Green pod health, atomically patches Service selectors to `green`, verifies EndpointSlice convergence, and tests external health. If any check fails, it automatically restores Blue selectors.
  - `rollback-blue`: Instantly rolls back traffic to Blue with identical safety validations.
- **Verification**: Zero-downtime live traffic cutover confirmed on `http://localhost`. Instant rollback demonstrated in `< 2` seconds.

### Phase 11: GitOps Implementation Using ArgoCD
- **ArgoCD Engine (`argocd` namespace)**:
  - Installed stable ArgoCD `v3.6.1` via [gitops/setup-argocd.ps1](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/gitops/setup-argocd.ps1).
  - Web UI securely accessible via port-forward (`https://localhost:8084`) with initial admin password retrieved securely from Kubernetes Secrets.
- **Declarative Source of Truth (`gitops/`)**:
  - `application.yaml`: ArgoCD Application CR tracking `gitops/manifests` on branch `develop` with automated synchronization (`prune: true`, `selfHeal: true`).
- **Blue-Green Selector Compatibility**: Configured `ignoreDifferences` on Service `/spec/selector` with `RespectIgnoreDifferences=true`, enabling `k8s/blue-green.ps1` to switch traffic without triggering GitOps self-healing resets.
- **Resource Boundaries**: ArgoCD authoritatively owns ConfigMaps and RBAC; sensitive Secrets and PVCs are excluded from GitOps to protect credentials and durable data.
- **Verification**: Application reported **`Synced`** and **`Healthy`**. Manual cluster drift automatically self-healed to the Git state.

---

## 6. Verification Results & Evaluation Rubric Alignment

The table below maps the implemented components directly to the **100-Mark Evaluation Rubric** specified in the official capstone syllabus:

| Evaluation Component | Max Marks | Implementation Highlights | Verification Evidence |
| :--- | :---: | :--- | :--- |
| **Application Development** | **15** | Full-stack Task Manager: Express.js REST API, React Vite frontend, Supabase PostgreSQL, JWT auth, task CRUD. | Web UI verified at `http://localhost:8080` and `http://localhost`. All REST endpoints functional. |
| **Git Repository Management** | **10** | Monorepo structure, GitFlow branching model (`main`, `develop`, feature branches), `CONTRIBUTING.md`. | Clean Git commit history, pull request merges, conflict resolution. |
| **Jenkins CI/CD Pipeline** | **10** | DooD Jenkins container (`:8085`), 5-stage declarative pipeline, SCM polling triggers, artifact packaging. | Build #30 passed (**SUCCESS**), archived release bundles. |
| **Docker Implementation** | **10** | Multi-stage non-root Dockerfiles (`node:20.20.2-alpine3.23`, `nginx:1.27.5-alpine`), Docker Compose. | `docker compose ps` healthy; images run securely as non-root. |
| **Kubernetes Deployment** | **15** | Dual-replica Deployments, Services, ConfigMaps, Secrets, 1Gi PV/PVC, health probes. | Scaling (2->4), rolling update, rollback, and storage persistence verified. |
| **Ansible Automation** | **10** | 4 production playbooks for engine installation, Kubernetes setup, app deployment, and ConfigMap management. | WSL2 execution, idempotent configuration updates, rolling restarts. |
| **Terraform Infrastructure** | **10** | Modular IaC (`kreuzwerker/docker`), parameterized variables, sensitive secret masking, isolated ports. | `terraform apply` and `terraform destroy` lifecycle verified with 0 errors. |
| **Monitoring & Logging** | **5** | Prometheus, 8-panel Grafana dashboard, Metrics Server, and Fluentd DaemonSet centralized logging. | Targets `UP`, live dashboards at `http://localhost:3001`, logs collected in `/var/log/fluentd-central/`. |
| **Security Implementation** | **5** | SonarQube SAST, Trivy container CVE scans, minimal RBAC (`task-manager-operator`), no default passwords. | Quality Gate PASSED, 0 High/Critical CVEs, RBAC secret-access denied. |
| **GitOps / Deployment Strategy** | **5** | Blue-Green zero-downtime deployment controller (`blue-green.ps1`) and ArgoCD v3.6.1 GitOps continuous sync. | EndpointSlice cutover verified; ArgoCD Application `Synced` & `Healthy`. |
| **Documentation & Demo** | **5** | Complete capstone report, phase READMEs, architecture diagrams, and operational scripts. | [CAPSTONE_REPORT.md](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/CAPSTONE_REPORT.md), [notes.md](file:///c:/Users/nik84/OneDrive/Desktop/task-manager-devops/notes.md), and quickstart guides. |
| **TOTAL MARKS** | **100** | **Comprehensive Full-Spectrum DevOps Solution** | **All 11 Syllabus Phases Fully Verified** |

---

## 7. Challenges & Mitigations

Throughout the implementation of this capstone, several engineering challenges were diagnosed and resolved:

1. **Docker-in-Docker Permissions on Windows**:
   - *Challenge*: Jenkins running inside Docker could not access `/var/run/docker.sock` due to Windows Docker Desktop socket permission disparities.
   - *Mitigation*: Configured `group_add` with host docker GID in `jenkins/docker-compose.yml`, enabling Jenkins to build and scan container images natively.
2. **Kubernetes hostPath Storage Permissions**:
   - *Challenge*: The `hostPath` volume for `/app/logs` defaulted to `root:root (0755)`, causing write permission denials for the unprivileged backend user (UID `1001`).
   - *Mitigation*: Introduced an `initContainer` (`init-storage-permissions`) executing `chown -R 1001:1001 /app/logs` before application startup.
3. **SonarScanner Memory Spikes on Frontend Assets**:
   - *Challenge*: The SonarScanner JavaScript/CSS bridge crashed on minified stylesheets due to Node.js heap exhaustion under load.
   - *Mitigation*: Capped analyzer memory using `-Dsonar.javascript.node.maxspace=512` in `Jenkinsfile` and excluded vendor CSS in `sonar-project.properties`.
4. **GitOps Self-Healing vs. Blue-Green Selector Switching**:
   - *Challenge*: When `blue-green.ps1` updated Service selectors to `green`, ArgoCD detected drift from Git and automatically reverted the selector back to `blue`.
   - *Mitigation*: Configured `ignoreDifferences` on `/spec/selector` for both Services with `RespectIgnoreDifferences=true` in `gitops/application.yaml`, allowing dynamic traffic switching while preserving GitOps ownership of ports and metadata.
5. **Ansible & ArgoCD Ownership Overlap**:
   - *Challenge*: Running Ansible playbooks could overwrite ConfigMaps or RBAC objects actively managed by ArgoCD.
   - *Mitigation*: Added fail-safe cluster queries in Ansible playbooks to detect the active ArgoCD Application and safely skip managed resources.

---

## 8. Future Scope

While the capstone project fulfills 100% of the syllabus requirements, potential future enhancements include:

1. **Cloud Kubernetes Deployment**: Migrate from local Docker Desktop Kubernetes to a managed cloud cluster (AWS EKS, Google Cloud GKE, or Azure AKS).
2. **Horizontal Pod Autoscaling (HPA)**: Configure Kubernetes HPA to automatically scale pod replicas between 2 and 10 based on real-time CPU/memory thresholds from Metrics Server.
3. **Automated Helm Packaging**: Package the application manifests into parameterized Helm charts for simplified multi-environment templating (staging vs. production).
4. **Distributed Tracing**: Integrate OpenTelemetry and Jaeger/Tempo to trace end-to-end request latency across frontend, backend, and PostgreSQL database queries.
5. **ChatOps Notifications**: Add automated Slack or email webhook alerts for pipeline completions, security scan failures, and GitOps sync errors.

---

## 9. Verification Screenshots & Artifact Directory

For physical or PDF submission, the following verification screenshots and artifacts are documented and reproducible:

| Checkpoint # | Deliverable / Component | Verification Command / URL | Verified Output |
| :---: | :--- | :--- | :--- |
| **SS-01** | Git Branching & Commit Log | `git log --graph --oneline --all -n 15` | Branches `develop`, `main`, feature PR merges |
| **SS-02** | Jenkins CI Pipeline Execution | `http://localhost:8085/job/task-manager-cicd/` | Build #30 green stage view, artifacts stored |
| **SS-03** | SonarQube Quality Gate | `http://localhost:9000/dashboard?id=task-manager` | Quality Gate Passed, 0 vulnerabilities |
| **SS-04** | Trivy Container Security Scan | Jenkins Build Console Output (Stages 7 & 8) | 0 High, 0 Critical vulnerabilities detected |
| **SS-05** | Docker Compose Application | `http://localhost:8080` & `docker compose ps` | Frontend UI loaded, containers `Up (healthy)` |
| **SS-06** | Kubernetes Cluster Workloads | `kubectl get pods,svc,pvc -n task-manager` | 4/4 pods Running, Services mapped, PVC bound |
| **SS-07** | Ansible Playbook Execution | `ansible-playbook -i inventory/hosts.ini ...` | Zero failed tasks, changed=0 (idempotent) |
| **SS-08** | Terraform Lifecycle | `terraform plan` & `terraform apply` | Resources provisioned in isolated docker network |
| **SS-09** | Grafana Observability Dashboard | `http://localhost:3001` (Dashboard: overview) | 8 active panels displaying live metrics |
| **SS-10** | Centralized Logging (Fluentd) | `kubectl exec -n logging ds/fluentd -- ls ...`| Log files present in `/var/log/fluentd-central/` |
| **SS-11** | Blue-Green Traffic Switch | `powershell .\k8s\blue-green.ps1 -Action status`| Active selector cutover from blue to green |
| **SS-12** | ArgoCD GitOps Sync State | `https://localhost:8084` (task-manager-gitops)| Status: Synced, Health: Healthy |

---

## 10. Conclusion

The **Task Management System DevOps Capstone Project** demonstrates a complete, industry-standard, cloud-native DevOps lifecycle. By integrating version control, continuous integration, containerization, Kubernetes orchestration, Ansible configuration management, Terraform infrastructure provisioning, Prometheus/Grafana observability, Fluentd centralized logging, DevSecOps security scanning, Blue-Green zero-downtime deployment, and ArgoCD GitOps delivery, the project successfully delivers an automated, secure, and production-ready software platform fulfilling all criteria of the **ENSP461** syllabus.
