# Phase 11: GitOps Implementation Using ArgoCD

This directory provides **GitOps Continuous Delivery** for the **Task Management System** on Kubernetes using **ArgoCD (`v3.6.1`)**.

---

## 1. GitOps Architecture

```text
  ┌──────────────────────────┐        (1) Poll / Push         ┌─────────────────────────────────────────┐
  │ GitHub Repository        │ ◄───────────────────────────── │ Jenkins CI (jenkins-devops :8085)       │
  │ Nik848/task-manager-     │                                │ • Lint, Test, SonarQube, Trivy, Package │
  │ devops (branch: develop) │                                └─────────────────────────────────────────┘
  └─────────────┬────────────┘
                │ (2) GitOps Reconciliation (repoURL, targetRevision: develop, path: gitops/)
                ▼
  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ ArgoCD Control Plane (Namespace: argocd, v3.6.1)                                                    │
  │ • argocd-repo-server (renders Kustomize manifests in gitops/)                                       │
  │ • argocd-application-controller (prune: true, selfHeal: true, RespectIgnoreDifferences=true)        │
  │ • argocd-server (ClusterIP UI accessed via kubectl port-forward)                                    │
  └─────────────┬───────────────────────────────────────────────────────────────────────────────────────┘
                │ (3) Syncs Declarative State
                ▼
  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Application Namespace: task-manager                                                                 │
  │ ┌──────────────────────────────────────────┐   ┌──────────────────────────────────────────────────┐ │
  │ │ ArgoCD-Managed Resources                 │   │ Externally / Blue-Green-Controlled               │ │
  │ │ • ConfigMap (task-manager-config)        │   │ • Secret (task-manager-secret) — not in Git      │ │
  │ │ • RBAC (task-manager-operator, Role)     │   │ • PV/PVC (task-manager-pv/pvc) — protected       │ │
  │ │ • Deployments (blue & green)             │   │ • Service spec.selector (controlled by           │ │
  │ │ • Services (ports, type, metadata)       │   │   k8s/blue-green.ps1 via ignoreDifferences)      │ │
  │ └──────────────────────────────────────────┘   └──────────────────────────────────────────────────┘ │
  └─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```text
gitops/
├── README.md                  # GitOps architecture, setup, and operations guide
├── application.yaml           # ArgoCD Application CRD (task-manager-gitops)
├── kustomization.yaml         # Kustomize entrypoint aggregating gitops/manifests/
└── manifests/                 # Declarative manifests managed by ArgoCD
    ├── backend-blue.yaml      # Blue backend Deployment (v1.0.0)
    ├── frontend-blue.yaml     # Blue frontend Deployment (v1.0.1)
    ├── backend-green.yaml     # Green backend Deployment (v2.0.0-green)
    ├── frontend-green.yaml    # Green frontend Deployment (v2.0.0-green)
    ├── backend-service.yaml   # ClusterIP Service (:3000)
    ├── frontend-service.yaml  # LoadBalancer Service (:80)
    ├── configmap.yaml         # Non-sensitive runtime configuration
    └── rbac.yaml              # Namespace-scoped RBAC demonstration account
```

---

## 3. ArgoCD Installation & UI Access

ArgoCD is installed in the dedicated `argocd` namespace using the pinned official release `v3.6.1`:
```powershell
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply --server-side --force-conflicts -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/v3.6.1/manifests/install.yaml
kubectl get pods -n argocd
```

### Accessing the ArgoCD UI Locally (No Public Exposure)
`argocd-server` remains an internal `ClusterIP` Service. Access it via `kubectl port-forward`:
```powershell
kubectl port-forward svc/argocd-server -n argocd 8084:443
```
Open **`https://localhost:8084`** (accept the self-signed certificate in local dev).

### Retrieving the Initial Administrator Password Securely
Never commit the ArgoCD admin password or tokens to Git. Retrieve it locally at runtime from Kubernetes:
```powershell
# Username: admin
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | ForEach-Object { [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($_)) }
```

---

## 4. Repository Connection & Application Configuration

- **Public Repository**: `https://github.com/Nik848/task-manager-devops` (`develop` branch) is connected via HTTPS without embedding GitHub Personal Access Tokens in YAML files. For private repositories, register credentials via `argocd repo add` or an untracked Kubernetes Secret in `argocd`.
- **Application (`gitops/application.yaml`)**:
  - `repoURL`: `https://github.com/Nik848/task-manager-devops`
  - `targetRevision`: `develop`
  - `path`: `gitops`
  - `destination`: `https://kubernetes.default.svc`, namespace `task-manager`
  - `syncPolicy.automated`: `prune: true`, `selfHeal: true`
  - `syncOptions`: `CreateNamespace=true`, `RespectIgnoreDifferences=true`, `ServerSideApply=true`

### Ownership Boundaries & Blue-Green / Ansible Compatibility
- **ArgoCD Owns**: `ConfigMap/task-manager-config`, `ServiceAccount/Role/RoleBinding`, `Deployment/backend-blue`, `Deployment/frontend-blue`, `Deployment/backend-green`, `Deployment/frontend-green`, and `Service` base definitions (ports/type/labels).
- **Ansible Integration**: When `task-manager-gitops` is present in `argocd`, `ansible/playbooks/configure_application.yml` and `ansible/playbooks/deploy_application.yml` defer ConfigMap ownership to ArgoCD (requiring edits in `gitops/manifests/configmap.yaml` on `develop`) and preserve any active Blue-Green `spec.selector.version` (`blue` or `green`) on `backend-service` and `frontend-service`. When GitOps is not installed, Ansible remains usable independently.
- **Protected Outside GitOps**:
  - `Secret/task-manager-secret`: Excluded from `gitops/`; provisioned via `k8s/deploy.ps1` from local `.env` so real credentials are never committed or overwritten.
  - `PV/task-manager-pv` & `PVC/task-manager-pvc`: Excluded from `gitops/` so automated `prune: true` can never delete persistent storage.
  - `Ingress/task-manager-ingress`: Excluded from `gitops/` on Docker Desktop because no Ingress controller is installed (keeping `Ingress` would hold ArgoCD health at `Progressing`).
- **Blue-Green Selector Coexistence**: `gitops/application.yaml` configures `ignoreDifferences` on `/spec/selector` for `kind: Service` with `RespectIgnoreDifferences=true`. This allows `k8s/blue-green.ps1` to switch `backend-service` and `frontend-service` between `version=blue` and `version=green` without ArgoCD self-heal reverting traffic.

---

## 5. Jenkins vs. ArgoCD Responsibilities

| Dimension | Jenkins (Continuous Integration) | ArgoCD (Continuous Delivery / GitOps) |
| :--- | :--- | :--- |
| **Role** | Builds, lints, tests, runs SonarQube static analysis, scans images with Trivy, packages artifacts. | Watches Git `develop` (`gitops/`) and reconciles cluster state continuously. |
| **Trigger** | `pollSCM('* * * * *')` on Git commits. | Git polling / hard refresh on `develop`. |
| **Cluster State** | Does **not** deploy or switch Blue-Green traffic automatically on push. | Applies manifest updates, self-heals drift, and prunes removed GitOps resources. |

---

## 6. Troubleshooting & Operations Commands

```powershell
# Apply ArgoCD Application
kubectl apply -f gitops/application.yaml

# Check sync and health status
kubectl get application task-manager-gitops -n argocd

# Trigger immediate Git refresh
kubectl annotate application task-manager-gitops -n argocd argocd.argoproj.io/refresh=hard --overwrite

# Inspect Application conditions or resource tree
kubectl describe application task-manager-gitops -n argocd
```
