# Terraform Infrastructure as Code (Phase 6)

This directory provides automated, declarative Infrastructure as Code (IaC) for the **Task Management System** using **Terraform** and the official **Docker Provider** (`kreuzwerker/docker`).

---

## 1. Architecture Overview

The Terraform configuration defines and manages a complete, isolated application stack alongside existing development and production environments without port or resource collisions.

```text
                               Docker Desktop Host Engine
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                        │
│   Existing Environments                     Terraform IaC Environment (Phase 6)        │
│   ─────────────────────                     ───────────────────────────────────        │
│   • Docker Compose: Ports 3000, 8080        • Custom Bridge: taskmanager-tf-network    │
│   • Kubernetes:     Port 80 (LoadBalancer)  • Volume:        taskmanager-tf-logs       │
│   • Jenkins CI/CD:  Port 8085               • Backend:       Port 3001 (Host) ➔ 3000   │
│                                             • Frontend:      Port 8088 (Host) ➔ 80     │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory and Module Structure

```text
terraform/
├── .gitignore                      # Excludes .terraform/, *.tfstate, and *.tfvars
├── README.md                       # Complete operations manual & architecture guide
├── main.tf                         # Root module: network, volume, module invocations
├── variables.tf                    # Root input variables with validation and types
├── outputs.tf                      # Useful endpoints, container IDs, and network metadata
├── terraform.tfvars.example        # Sanitized template with placeholder secrets
└── modules/
    └── docker_container/           # Reusable container module
        ├── main.tf                 # Generic docker_container resource definition
        ├── variables.tf            # Parameterized container inputs (ports, env, volumes)
        └── outputs.tf              # Container ID, name, published ports
```

---

## 3. Provider Selection & Version Pinning

- **Provider**: `kreuzwerker/docker` (pinned to `~> 3.0.2`).
- **Terraform Version**: `>= 1.5.0` (validated on `Terraform v1.17.2` on `linux_amd64` under WSL2).
- **Docker Host**:
  - Under **WSL2 / Linux**: Defaults to `unix:///var/run/docker.sock`.
  - Under **Windows native PowerShell**: Configure `docker_host = "npipe:////./pipe/docker_engine"`.

---

## 4. Reusable Module Design (`modules/docker_container`)

The `docker_container` module encapsulates container lifecycle management:
- **Networking**: Automatically joins the dedicated bridge network with custom service aliases.
- **Port Mapping**: Dynamically creates port bindings when `internal_port` and `external_port` are defined.
- **Volume Mounts**: Attaches persistent data volumes (e.g., application logs).
- **Environment Variables**: Injects non-sensitive and sensitive configuration without leaking credentials.
- **Health Checks**: Configures custom container health probes matching the application requirements.

---

## 5. Variables and Outputs Reference

### Key Input Variables (`variables.tf`)

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `docker_host` | string | `unix:///var/run/docker.sock` | Docker daemon socket URL. |
| `environment_prefix` | string | `taskmanager-tf` | Name prefix for isolated containers. |
| `backend_host_port` | number | `3001` | Host port mapped to backend (avoids 3000 collision). |
| `frontend_host_port` | number | `8088` | Host port mapped to frontend (avoids 80/8080 collision). |
| `backend_image` | string | `taskmanager-backend:latest` | Local image tag for backend service. |
| `frontend_image` | string | `taskmanager-frontend:latest` | Local image tag for frontend service. |
| `database_url` | string | `""` | Database connection URL (**marked `sensitive = true`**). |
| `jwt_secret` | string | `dev-insecure-jwt-secret...` | JWT secret (**marked `sensitive = true`**). |

### Key Outputs (`outputs.tf`)

| Output | Description | Example |
| :--- | :--- | :--- |
| `backend_endpoint` | Backend API URL on host | `http://localhost:3001` |
| `frontend_url` | Frontend web UI URL on host | `http://localhost:8088` |
| `backend_container_name` | Name of running backend container | `taskmanager-tf-backend` |
| `frontend_container_name`| Name of running frontend container | `taskmanager-tf-frontend` |
| `network_name` | Created Docker bridge network | `taskmanager-tf-network` |
| `log_volume_name` | Created persistent log volume | `taskmanager-tf-logs` |

> [!NOTE]
> Secrets (`database_url`, `jwt_secret`) are never exported as outputs or logged in plaintext.

---

## 6. Execution Instructions

### A. Prerequisites
1. Docker Desktop running on Windows 11.
2. Terraform CLI installed (e.g., inside Ubuntu on WSL2: `sudo apt install terraform` or via Homebrew/apt).
3. Local images pre-built (e.g., via Docker Compose or Jenkins pipeline: `taskmanager-backend:latest`, `taskmanager-frontend:latest`).

### B. Formatting and Validation
```bash
cd terraform

# Check code formatting:
terraform fmt -check

# Initialize provider and modules:
terraform init

# Validate configuration syntax:
terraform validate
```

### C. Planning and Applying
```bash
# 1. Review execution plan:
terraform plan

# 2. Apply infrastructure:
terraform apply -auto-approve

# 3. Test endpoints:
curl http://localhost:8088/
curl http://localhost:3001/health

# 4. Clean teardown (reproducibility):
terraform destroy -auto-approve
```

---

## 7. Security & State-File Management

1. **Zero Secret Leaks**:
   - Sensitive variables (`database_url`, `jwt_secret`) are marked with `sensitive = true` to suppress their values from Terraform plan and apply output.
   - `terraform.tfvars.example` provides sanitized placeholders only.
2. **Git Ignore Protections**:
   - Both `terraform/.gitignore` and the repository root `.gitignore` exclude `*.tfstate`, `*.tfstate.*`, `*.tfvars`, `*.tfplan`, and `.terraform/`.
   - Real state files containing sensitive data are never committed to version control.

---

## 8. Coexistence with Docker Compose, Kubernetes, and Ansible

| Tool | Role in Project | Ports / Scope | State & Orchestration |
| :--- | :--- | :--- | :--- |
| **Docker Compose** | Local Developer Experience | Host ports `3000` & `8080` | `docker-compose.yml`, ephemeral development containers. |
| **Kubernetes** | Production Cluster Deployment | Port `80` (LoadBalancer) | `k8s/` manifests in `task-manager` namespace with 2 replicas, self-healing, rolling updates. |
| **Ansible** | Configuration & Provisioning | In-cluster ConfigMaps | Dynamic rollout restart on config drift; Flannel CNI; Linux host provisioning playbooks. |
| **Terraform** | Infrastructure as Code (IaC) | Host ports `3001` & `8088` | Reusable modular architecture (`modules/docker_container`), declared state, isolated parallel stack. |
