# Jenkins CI/CD Automation Guide — Task Management System

This directory contains the Dockerized Jenkins setup and CI/CD documentation for the **Task Management System** DevOps capstone.

---

## 1. Jenkins Architecture on Windows (Docker Desktop)

The Jenkins pipeline runs in a specialized container that interfaces seamlessly with the host Docker Engine and Kubernetes control plane:

```
    [ GitHub Repository ] (push to 'develop')
              │
              ▼ (Webhook / SCM Polling)
    ┌─────────────────────────────────────────────────────────────┐
    │             Docker Desktop for Windows Host                 │
    │                                                             │
    │   ┌─────────────────────────────────────────────────────┐   │
    │   │  Custom Jenkins Container (Port 8085)               │   │
    │   │  - OpenJDK 17 + Jenkins LTS                         │   │
    │   │  - Docker CE CLI (talks to /var/run/docker.sock)    │   │
    │   │  - kubectl CLI (talks to host.docker.internal)      │   │
    │   │  - Node.js 20 & npm                                 │   │
    │   │  - Trivy Vulnerability Scanner                      │   │
    │   └──────────────────────┬──────────────────────────────┘   │
    │                          │                                  │
    │          ┌───────────────┴───────────────┐                  │
    │          ▼                               ▼                  │
    │   [ Docker Engine ]            [ Kubernetes Cluster ]       │
    │   - Build backend & frontend   - Namespace: task-manager    │
    │   - Scan with Trivy            - Rolling update to pods     │
    │   - Push to GHCR               - Verify rollouts            │
    └─────────────────────────────────────────────────────────────┘
```

---

## 2. Quick Setup Instructions

Run the setup script from PowerShell to build the custom Jenkins image and start the container:

```powershell
powershell -ExecutionPolicy Bypass -File .\jenkins\setup-jenkins.ps1
```

- **Jenkins Web UI**: Access at **`http://localhost:8085`**
- **Admin Password**: Printed in the terminal output, or retrieve manually:
  ```powershell
  docker exec jenkins-devops cat /var/jenkins_home/secrets/initialAdminPassword
  ```

---

## 3. Required Jenkins Plugins

Install the following plugins from **Manage Jenkins $\rightarrow$ Plugins $\rightarrow$ Available Plugins**:

1. **Pipeline** (`workflow-aggregator`): Core declarative pipeline engine.
2. **Git Plugin** (`git`): Git SCM checkout support.
3. **GitHub Integration Plugin** (`github`): Webhooks and status checks.
4. **Credentials Binding Plugin** (`credentials-binding`): Injects secrets securely into build steps.
5. **AnsiColor** (`ansicolor`): Enables colored terminal console output in Jenkins.
6. **Docker Pipeline** (Optional): For advanced docker agent definitions.

---

## 4. Required Jenkins Credentials

Navigate to **Manage Jenkins $\rightarrow$ Credentials $\rightarrow$ System $\rightarrow$ Global credentials (unrestricted) $\rightarrow$ Add Credentials**:

| Credential ID | Kind | Purpose | Configuration Details |
| :--- | :--- | :--- | :--- |
| **`ghcr-credentials`** | **Username with password** | Pushing container images to GitHub Container Registry | - **Username**: Your GitHub username (e.g., `Nik848`)<br>- **Password**: GitHub Personal Access Token (PAT) with `write:packages` and `read:packages` scopes. |
| **`github-credentials`** | **Username with password** | GitHub repository checkout & status checks | - **Username**: Your GitHub username<br>- **Password**: GitHub PAT with `repo` scope. |
| **`supabase-database-url`** | **Secret text** | External PostgreSQL access for testing (Optional) | - **Secret**: Your Supabase connection string. |

---

## 5. Kubernetes Access from Jenkins

Inside Docker Desktop on Windows, the Jenkins container communicates with the Kubernetes cluster via the special DNS entry **`host.docker.internal`**:

1. The `docker-compose.yml` mounts `~/.kube` into `/home/jenkins/.kube:ro`.
2. To verify cluster communication from inside Jenkins, run:
   ```powershell
   docker exec jenkins-devops kubectl get nodes
   docker exec jenkins-devops kubectl get pods -n task-manager
   ```

---

## 6. Creating the Jenkins Pipeline Job

1. Open **`http://localhost:8085`**.
2. Click **New Item**.
3. Enter name: **`task-manager-ci-cd`**, select **Pipeline**, and click **OK**.
4. In the job configuration:
   - Check **GitHub project** and set Project url: `https://github.com/Nik848/task-manager-devops/`
   - Under **Build Triggers**, check **GitHub hook trigger for GITScm polling**.
   - Under **Pipeline**, select **Pipeline script from SCM**:
     - **SCM**: Git
     - **Repository URL**: `https://github.com/Nik848/task-manager-devops.git`
     - **Credentials**: Select `github-credentials`
     - **Branch Specifier**: `*/develop`
     - **Script Path**: `Jenkinsfile`
5. Click **Save**.

---

## 7. GitHub Webhook Configuration

When running Jenkins locally on Docker Desktop, GitHub needs a publicly reachable URL to send webhook events.

### Recommended Tool: Smee.io or ngrok

#### Option A: Smee.io (Free, persistent, no account needed)
1. Go to [https://smee.io](https://smee.io) and click **Start a new channel**. Copy your webhook proxy URL (e.g., `https://smee.io/abc123xyz`).
2. In your GitHub repository:
   - Navigate to **Settings $\rightarrow$ Webhooks $\rightarrow$ Add webhook**.
   - **Payload URL**: `https://smee.io/abc123xyz`
   - **Content type**: `application/json`
   - **Which events**: "Just the push event".
   - Click **Add webhook**.
3. On your machine, run the Smee forwarder:
   ```bash
   npx smee-client --url https://smee.io/abc123xyz --target http://localhost:8085/github-webhook/
   ```

#### Option B: ngrok
```bash
ngrok http 8085
```
Set GitHub webhook Payload URL to: `https://<your-ngrok-id>.ngrok-free.app/github-webhook/`.

---

## 8. Pipeline Stages Walkthrough

1. **Checkout**: Pulls the latest commit from `develop` branch.
2. **Backend Validation**: Runs `npm ci` and verifies syntax across all routes and configs.
3. **Frontend Validation**: Runs `npm ci` and compiles the React application (`vite build`).
4. **Docker Build**: Packages backend and frontend into tagged Docker images.
5. **Security Scanning**: Scans images with Trivy for high and critical CVEs.
6. **GHCR Publishing**: Authenticates with GitHub PAT and pushes images to `ghcr.io`.
7. **Kubernetes Deployment**: Updates `backend` and `frontend` deployments in `task-manager` namespace with zero downtime.
8. **Smoke Testing**: Validates backend `/health` and frontend availability over cluster network.
9. **Cleanup**: Performs registry logout and workspace housekeeping.
