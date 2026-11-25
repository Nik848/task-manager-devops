# Phase 9: Security Implementation

This directory and root configuration files implement Phase 9 DevOps security controls across **Static Code Analysis (SonarQube)**, **Container Vulnerability Scanning (Trivy)**, **Hardened Docker Images**, **Jenkins & Kubernetes Secret Management**, and **Least-Privilege Kubernetes RBAC**.

---

## 1. Security Architecture

```text
                                 Local DevSecOps Pipeline (Docker Desktop)
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                 │
│  [GitHub: develop] ──(pollSCM)──► [Jenkins Container: jenkins-devops (:8085)]                   │
│                                      │                                                          │
│                                      ├─► 1. SonarQube Static Analysis                           │
│                                      │      • Uses Jenkins Credential: sonarqube-token          │
│                                      │      • Connects to http://host.docker.internal:9000      │
│                                      │      • Reads sonar-project.properties                    │
│                                      │                                                          │
│                                      ├─► 2. Hardened Docker Builds                              │
│                                      │      • Pinned Alpine bases + apk upgrade --no-cache      │
│                                      │      • Non-root users (taskapp:1001, nginx:101)          │
│                                      │      • No .env, lockfiles, or npm/corepack in runtime    │
│                                      │                                                          │
│                                      └─► 3. Trivy Container Image Gate                          │
│                                             • trivy image --exit-code 1 --severity HIGH,CRITICAL│
│                                             • Scans backend and frontend images before package  │
│                                                                                                 │
│  [SonarQube Container: sonarqube-devops]                                                        │
│  • Image: sonarqube:25.12.0.117093-community                                                    │
│  • Port:  127.0.0.1:9000 (loopback only, embedded H2 DB, Docker volumes)                        │
│                                                                                                 │
│  [Kubernetes Cluster: docker-desktop]                                                           │
│  • task-manager pods: automountServiceAccountToken: false, runAsNonRoot: true, drop ALL caps    │
│  • task-manager-operator: namespace-scoped Role without Secret read access                      │
│  • monitoring / logging SAs: read-only ClusterRoles without Secret permissions                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. SonarQube Local Setup & Access

SonarQube Community Build runs locally via Docker Compose (`security/docker-compose.sonarqube.yml`):
- **Pinned Image**: `sonarqube:25.12.0.117093-community`
- **Database**: Embedded H2 database (simplest supported configuration for single-user capstone evaluation).
- **Storage**: Persistent Docker named volumes (`sonarqube_data`, `sonarqube_extensions`, `sonarqube_logs`).
- **Network Isolation**: Bound exclusively to `127.0.0.1:9000` so it is not exposed on external host interfaces.
- **Jenkins Connectivity**: Inside `jenkins-devops`, `extra_hosts: host.docker.internal:host-gateway` allows `@sonar/scan` to reach SonarQube at `http://host.docker.internal:9000`.

### Start & Access SonarQube
```powershell
# Start SonarQube
docker compose -f security/docker-compose.sonarqube.yml up -d

# Check readiness
curl.exe -s http://localhost:9000/api/system/status
```
- **Local Web UI**: `http://localhost:9000`
- **Project Key**: `task-manager-devops` (configured in `sonar-project.properties`, scanning `app/backend/src` and `app/frontend/src` while excluding `node_modules`, `dist`, `.env*`, and Terraform state).

---

## 3. Secret & Credential Management

### Segregation of Secrets
| Secret / Credential | Where Stored | Why |
| :--- | :--- | :--- |
| **`sonarqube-token`** | Jenkins Credentials (`StringCredentialsImpl`) | Used strictly during CI pipeline execution via `withCredentials` (`SONAR_TOKEN`), masked automatically in Jenkins console logs. |
| **`DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`** | Kubernetes Secret (`task-manager-secret`) | Required at runtime by backend pods in namespace `task-manager`. Provisioned from local `.env` or operator input, never committed to Git. |
| **`GRAFANA_ADMIN_PASSWORD`** | Environment variable -> K8s Secret (`grafana-secret`) | Dynamically created at deploy time by `monitoring/deploy.ps1`; fails safely if missing. |

### Safeguards Verified
- `.gitignore` excludes `.env`, `.env.*` (preserving `.env.example`), `*.pem`, `*.key`, `kubeconfig*`, `*.tfstate*`, and `*.tfvars`.
- `app/backend/.dockerignore` and `app/frontend/.dockerignore` exclude `.env`, `.env.*`, `.git`, and `node_modules`.
- `k8s/secret.yaml` contains only sanitized placeholders, and `k8s/deploy.ps1` halts with an error if `task-manager-secret` is missing and `.env` is absent or incomplete.

---

## 4. Docker Image Hardening & Trivy Scanning

### Hardening Controls
1. **Pinned Base Images**:
   - Backend: `node:20.20.2-alpine3.23`
   - Frontend: `node:20.20.2-alpine3.23` (build), `nginx:1.27.5-alpine` (runtime)
2. **OS Patching & Minimal Runtime**:
   - Both runtime stages execute `apk upgrade --no-cache`.
   - Backend runtime removes unnecessary build tools (`npm`, `corepack`) and excludes `package-lock.json` from the runtime layer.
3. **Non-Root Execution**:
   - Backend runs as `taskapp` (`UID 1001`).
   - Frontend runs as `nginx` (`UID 101`).
4. **Health Checks**: Preserved in both Dockerfiles (`/health` and `/`).

### Interpreting Trivy Scan Results
Jenkins Stages 7 and 8 run:
```bash
trivy image --exit-code 1 --scanners vuln --severity HIGH,CRITICAL --no-progress <image>
```
- **`--severity HIGH,CRITICAL`**: Filters output to actionable high-risk and critical CVEs.
- **`--exit-code 1`**: Fails the CI build immediately if any `HIGH` or `CRITICAL` vulnerability is detected.
- **Note on OS EOL warnings**: `nginx:1.27.5-alpine` is based on Alpine 3.21.3; upgrading to a newer Alpine release when moving to a newer Nginx minor version will keep OS vulnerability feeds current.

---

## 5. Kubernetes RBAC Audit

| ServiceAccount | Namespace | Role / ClusterRole | Permitted Resources & Verbs | Secret Access |
| :--- | :--- | :--- | :--- | :---: |
| **`default`** (app pods) | `task-manager` | None (`automountServiceAccountToken: false`) | No Kubernetes API access | **No** |
| **`task-manager-operator`** *(RBAC demo only; unused by workloads)* | `task-manager` | `Role/task-manager-role` | Read-only (`get`, `list`, `watch`) on `pods`, `pods/log`, `services`; `get`, `list`, `watch`, `create`, `update`, `patch` on `deployments` | **No** |
| **`prometheus`** | `monitoring` | `ClusterRole/prometheus-role` | Read-only (`get`, `list`, `watch`) on `nodes`, `services`, `endpoints`, `pods`, `/metrics` | **No** |
| **`kube-state-metrics`** | `monitoring` | `ClusterRole/kube-state-metrics` | Read-only (`get`, `list`, `watch`) on `pods`, `namespaces` | **No** |
| **`fluentd`** | `logging` | `ClusterRole/fluentd-role` | Read-only (`get`, `list`, `watch`) on `pods`, `namespaces` | **No** |

### Verification Commands
```powershell
kubectl auth can-i create deployments --as=system:serviceaccount:task-manager:task-manager-operator -n task-manager
kubectl auth can-i get secrets --as=system:serviceaccount:task-manager:task-manager-operator -n task-manager
kubectl auth can-i get pods --as=system:serviceaccount:task-manager:default -n task-manager
kubectl auth can-i list pods --as=system:serviceaccount:logging:fluentd
kubectl auth can-i get secrets --as=system:serviceaccount:logging:fluentd
```

---

## 6. Local Environment Limitations
- **Not Production-Grade Security**: This environment runs on a single-node Docker Desktop cluster on Windows 11.
- **SonarQube Embedded H2 Database**: Suitable only for local/evaluation use; production deployments require an external PostgreSQL database for SonarQube.
- **Jenkins DooD Socket**: Mounting `/var/run/docker.sock` grants the Jenkins container control over the host Docker daemon.
- **No NetworkPolicies or External KMS**: Secrets in Kubernetes are base64-encoded in etcd without an external KMS provider (e.g., HashiCorp Vault or cloud KMS), and Docker Desktop's default CNI does not enforce NetworkPolicies.
