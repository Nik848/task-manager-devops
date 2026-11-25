# Ansible Automation for Task Management System (Phase 5)

This directory provides automated provisioning, deployment, and configuration management for the Task Management System using **Ansible** running from **Ubuntu under WSL2**.

---

## Directory Structure

```text
ansible/
├── ansible.cfg                # Ansible defaults (inventory, callbacks, privilege settings)
├── requirements.yml           # Required Ansible collections (ansible.posix, community.general)
├── inventory/
│   ├── hosts.ini              # Host definitions (localhost, docker_nodes, k8s_nodes)
│   └── group_vars/
│       └── all.yml            # Environment variables and cluster deployment configs
├── playbooks/
│   ├── install_docker.yml         # Installs Docker Engine & Compose on Ubuntu Linux nodes
│   ├── install_kubernetes.yml     # Provisions Kubernetes via kubeadm on Linux nodes
│   ├── deploy_application.yml     # Orchestrates k8s/ manifests against the live cluster
│   └── configure_application.yml  # Manages non-sensitive app settings via ConfigMap
└── README.md                  # Comprehensive operations manual & architecture guide
```

---

## Execution Environment & Architecture

### Windows 11 & WSL2 Architecture
- **Control Machine**: Ubuntu running inside **WSL2** (`Ubuntu`, WSL version 2).
- **Ansible Version**: `ansible [core 2.20.1]`, Python 3.14.
- **Docker Integration**: WSL2 communicates with the Docker Desktop engine running on Windows via the integrated socket.
- **Kubernetes Integration**: WSL2 uses `kubectl` with context `docker-desktop` connected to the local control-plane.

```
       Windows 11 Host                                     WSL2 (Ubuntu)
┌─────────────────────────────────┐               ┌─────────────────────────────────┐
│ Docker Desktop & Kubernetes     │               │ Ansible Controller              │
│ - Cluster: desktop-control-plane│ ◄──────────── │ - ansible-playbook              │
│ - Context: docker-desktop       │   (kubeconfig)│ - Python 3.14, kubectl          │
│ - Namespace: task-manager       │               │                                 │
│ - Port 80 (LoadBalancer)        │ ◄──────────── │ Execution Target: localhost     │
└─────────────────────────────────┘  (docker CLI) └─────────────────────────────────┘
```

---

## The Four Playbooks

| Playbook | Purpose | Target Environment | Execution Status |
| :--- | :--- | :--- | :--- |
| **`install_docker.yml`** | Configures official Docker apt repository, installs Docker Engine, containerd, and Compose plugin with systemd management. | Conventional Ubuntu Linux nodes (`docker_nodes`). | **Syntax-Checked & Guard-Protected** (Not executed on live host: Docker Desktop engine preserved; guarded against execution on localhost/WSL2). |
| **`install_kubernetes.yml`** | Configures kernel modules (`overlay`, `br_netfilter`), sysctl networking, idempotent containerd with `SystemdCgroup = true`, disables swap, installs version-pinned `kubelet=1.31.0-1.1`/`kubeadm`/`kubectl`, installs Flannel CNI using `/root/.kube/config`, and securely propagates join tokens. | Conventional bare-metal / cloud Linux VMs (`k8s_nodes`). | **Syntax-Checked & Guard-Protected** (Not executed on live host: active Docker Desktop cluster preserved; guarded against execution on localhost/WSL2). |
| **`deploy_application.yml`** | Deploys `k8s/` manifests in strict dependency order, applies dynamic ConfigMap from Ansible single source of truth, conditionally restarts backend on ConfigMap change, validates secret existence, and waits for rollout. | Current cluster (`localhost` with `--context=docker-desktop`). | **Operationally Executed & Verified** (17 tasks OK, 0 failed). |
| **`configure_application.yml`** | Dynamically generates and applies `task-manager-config` ConfigMap using Ansible variables from `group_vars/all.yml`; triggers backend pod rollout restart *only* when configuration changes, and never prints secret data. | Current cluster (`localhost` with `--context=docker-desktop`). | **Operationally Executed & Verified** (Idempotency and conditional rollout verified). |

---

## WSL2 Setup & Prerequisites

From an Ubuntu WSL2 terminal:

```bash
# 1. Update apt and install Ansible
sudo apt update
sudo apt install -y ansible python3-pip

# 2. Install required Ansible collections
cd /mnt/c/Users/nik84/OneDrive/Desktop/task-manager-devops/ansible
ansible-galaxy collection install -r requirements.yml

# 3. Verify kubectl and context are accessible
kubectl config current-context
# Should return: docker-desktop (or switch using: kubectl config use-context docker-desktop)

# 4. Set Ansible configuration path
export ANSIBLE_CONFIG=ansible.cfg
```

---

## Running the Playbooks

### 1. Validate Inventory and Syntax
```bash
export ANSIBLE_CONFIG=ansible.cfg

# Inspect inventory
ansible-inventory -i inventory/hosts.ini --list

# Check syntax across all playbooks
ansible-playbook -i inventory/hosts.ini --syntax-check playbooks/install_docker.yml
ansible-playbook -i inventory/hosts.ini --syntax-check playbooks/install_kubernetes.yml
ansible-playbook -i inventory/hosts.ini --syntax-check playbooks/deploy_application.yml
ansible-playbook -i inventory/hosts.ini --syntax-check playbooks/configure_application.yml
```

### 2. Execute Configuration Management (Non-GitOps Fallback vs. ArgoCD Ownership)
```bash
ansible-playbook -i inventory/hosts.ini playbooks/configure_application.yml
```
- **When ArgoCD GitOps is Active (`task-manager-gitops` exists in `argocd`)**: ArgoCD is the authoritative owner of `task-manager-config`. Both `configure_application.yml` and `deploy_application.yml` automatically detect `task-manager-gitops`, skip overwriting `task-manager-config` (no legacy backend rollout triggered), and instruct operators to commit configuration updates in `gitops/manifests/configmap.yaml` on `develop`.
- **When GitOps is Not Installed**: Ansible retains full Phase 5 ConfigMap management (`group_vars/all.yml` as single source of truth), triggering `kubectl rollout restart deployment/backend` only when ConfigMap values change (`changed=1`).

### 3. Execute Application Deployment (Blue-Green Safe)
```bash
ansible-playbook -i inventory/hosts.ini playbooks/deploy_application.yml
```
- Before applying `backend-service.yaml` or `frontend-service.yaml`, `deploy_application.yml` inspects `spec.selector.version` and preserves any active Blue-Green selector (`blue` or `green`), preventing accidental traffic resets.

### 4. Dry-Run / Check Mode
```bash
ansible-playbook -i inventory/hosts.ini --check playbooks/configure_application.yml
```

---

## Remote Linux Provisioning Requirements (`install_docker.yml` & `install_kubernetes.yml`)

To execute `install_docker.yml` or `install_kubernetes.yml` against conventional cloud or on-premise Linux servers:

### Target Host Requirements
1. **Operating System**: Clean installation of Ubuntu 22.04 LTS or Ubuntu 24.04 LTS (amd64 / arm64).
2. **Access & Privileges**: SSH access with key-based authentication and passwordless sudo for the configured `ansible_user`.
3. **Hardware for Kubernetes**: Minimum 2 CPUs, 2 GB RAM per node, unique hostname, MAC address, and product_uuid for every node.
4. **Network Ports**:
   - Kubernetes Control Plane: `6443` (API Server), `2379-2380` (etcd), `10250` (Kubelet), `10259` (kube-scheduler), `10257` (kube-controller-manager).
   - Kubernetes Worker Nodes: `10250` (Kubelet), `30000-32767` (NodePort Services).
   - Flannel CNI: `8472/UDP` (VXLAN).

### Execution Steps for Remote Hosts
1. Define target hosts in `ansible/inventory/hosts.ini`:
   ```ini
   [docker_nodes]
   docker-vm1 ansible_host=192.168.1.100 ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/id_rsa

   [k8s_control_plane]
   k8s-master ansible_host=192.168.1.101 ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/id_rsa

   [k8s_workers]
   k8s-worker1 ansible_host=192.168.1.102 ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/id_rsa
   ```
2. Run installation playbooks:
   ```bash
   ansible-playbook -i inventory/hosts.ini playbooks/install_docker.yml
   ansible-playbook -i inventory/hosts.ini playbooks/install_kubernetes.yml
   ```

---

## Docker Desktop & Environment Compatibility Notes

1. **Docker Desktop vs. `install_docker.yml`**:
   Docker Desktop on Windows manages its own hypervisor VM and Docker Engine. `install_docker.yml` includes an environment detection guard that prevents modifying Docker Desktop while remaining fully functional for remote Ubuntu hosts.
2. **Docker Desktop Kubernetes vs. `install_kubernetes.yml`**:
   The active Kubernetes cluster is provided by Docker Desktop (`v1.36.1`). `install_kubernetes.yml` is an idempotent reference playbook for provisioning conventional cloud/bare-metal Linux nodes via `kubeadm` with Kubernetes `v1.31` (`1.31.0-1.1`), containerd `SystemdCgroup = true`, and predictable kubeconfig paths. It does not execute destructive `kubeadm init` commands against the running Docker Desktop cluster.
3. **Secret Protection & Zero-Placeholder Policy**:
   `deploy_application.yml` and `configure_application.yml` require that `task-manager-secret` exists and fail immediately with clear instructions if absent. Placeholder credentials from `k8s/secret.yaml` are never automatically applied, and secret values are never printed in Ansible logs or debug output.
4. **Conditional Rollout Restarts**:
   Both `deploy_application.yml` and `configure_application.yml` track ConfigMap changes (`changed=1`). Rolling restarts of the backend deployment are executed only when configuration actually changes; repeated runs with identical variables leave pods untouched.
