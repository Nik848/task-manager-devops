# Ansible Automation for Task Management System (Phase 5)

This directory provides automated provisioning, deployment, and configuration management for the Task Management System using **Ansible** running from **Ubuntu under WSL2**.

---

## Directory Structure

```text
ansible/
├── ansible.cfg                # Ansible defaults (inventory, callbacks, privilege settings)
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
| **`install_docker.yml`** | Configures official Docker apt repository, installs Docker Engine, containerd, and Compose plugin with systemd management. | Conventional Ubuntu Linux nodes (`docker_nodes`). | **Syntax Verified** (Guard prevents overwriting existing Windows Docker Desktop engine). |
| **`install_kubernetes.yml`** | Configures kernel modules (`overlay`, `br_netfilter`), sysctl networking, containerd Cgroups, disables swap, installs `kubelet`/`kubeadm`/`kubectl`, and bootstraps cluster. | Conventional bare-metal / cloud Linux VMs (`k8s_nodes`). | **Syntax Verified** (Guard protects active Docker Desktop cluster from kubeadm reset/init). |
| **`deploy_application.yml`** | Deploys `k8s/` manifests in dependency order (Namespace $\rightarrow$ Storage $\rightarrow$ RBAC $\rightarrow$ Config $\rightarrow$ Services $\rightarrow$ Ingress $\rightarrow$ Deployments) and waits for rollout. | Current cluster (`localhost` with `--context=docker-desktop`). | **Executed & Verified** (15 tasks OK, 0 failed). |
| **`configure_application.yml`** | Dynamically generates and applies `task-manager-config` ConfigMap using Ansible variables without touching or exposing sensitive secrets. | Current cluster (`localhost` with `--context=docker-desktop`). | **Executed & Verified** (6 tasks OK, 0 failed). |

---

## WSL2 Setup & Prerequisites

From an Ubuntu WSL2 terminal:

```bash
# 1. Update apt and install Ansible
sudo apt update
sudo apt install -y ansible python3-pip

# 2. Verify kubectl and context are accessible
kubectl config current-context
# Should return: docker-desktop (or switch using: kubectl config use-context docker-desktop)

# 3. Navigate to repository ansible directory
cd /mnt/c/Users/nik84/OneDrive/Desktop/task-manager-devops/ansible
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

### 2. Execute Configuration Management
```bash
ansible-playbook -i inventory/hosts.ini playbooks/configure_application.yml
```
*Expected Result*:
```text
PLAY RECAP *********************************************************************
localhost                  : ok=6    changed=1    unreachable=0    failed=0    skipped=0
```

### 3. Execute Application Deployment
```bash
ansible-playbook -i inventory/hosts.ini playbooks/deploy_application.yml
```
*Expected Result*:
```text
PLAY RECAP *********************************************************************
localhost                  : ok=15   changed=2    unreachable=0    failed=0    skipped=1
```

### 4. Dry-Run / Check Mode
```bash
ansible-playbook -i inventory/hosts.ini --check playbooks/configure_application.yml
```

---

## Docker Desktop & Environment Compatibility Notes

1. **Docker Desktop vs. `install_docker.yml`**:
   Docker Desktop on Windows manages its own hypervisor VM and Docker Engine. `install_docker.yml` includes an environment detection guard that prevents modifying Docker Desktop while remaining fully functional for remote Ubuntu hosts.
2. **Docker Desktop Kubernetes vs. `install_kubernetes.yml`**:
   The active Kubernetes cluster is provided by Docker Desktop (`v1.36.1`). `install_kubernetes.yml` is an idempotent reference playbook for provisioning conventional cloud/bare-metal Linux nodes via `kubeadm`. It does not execute destructive `kubeadm init` commands against the running Docker Desktop cluster.
3. **Secret Protection**:
   `deploy_application.yml` and `configure_application.yml` check for the existence of `task-manager-secret` before performing any operations and never overwrite active database credentials with placeholders.
