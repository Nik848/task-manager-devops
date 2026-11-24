<#
.SYNOPSIS
  Setup and launch custom Jenkins container with Docker, Node 20, kubectl, and Trivy on Windows.
#>

[CmdletBinding()]
param (
    [int]$JenkinsPort = 8085
)

$ErrorActionPreference = "Stop"

function Write-Step { param([string]$msg) Write-Host "`n=== [STEP] $msg ===" -ForegroundColor Cyan }
function Write-Success { param([string]$msg) Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "[WARNING] $msg" -ForegroundColor Yellow }

Write-Step "Checking Docker availability"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker is not installed or not in PATH. Please start Docker Desktop."
}
docker version | Out-Null
Write-Success "Docker daemon is running."

# 1. Ensure volume exists without deleting existing data
Write-Step "Ensuring persistent Jenkins data volume 'jenkins_home'"
$volExists = docker volume ls -q -f name=jenkins_home
if (-not $volExists) {
    docker volume create jenkins_home | Out-Null
    Write-Success "Created new volume 'jenkins_home'."
} else {
    Write-Success "Existing volume 'jenkins_home' preserved."
}

# 2. Build custom Jenkins image
Write-Step "Building custom Jenkins image with Docker, kubectl, Node 20, and Trivy"
$composeFile = Join-Path $PSScriptRoot "docker-compose.yml"
docker compose -f $composeFile build
Write-Success "Custom Jenkins image built successfully."

# 3. Start Jenkins container
Write-Step "Starting Jenkins container on port $JenkinsPort"
docker compose -f $composeFile up -d
Write-Success "Jenkins container started."

# 4. Wait for Jenkins to become responsive
Write-Step "Waiting for Jenkins to initialize..."
$maxAttempts = 30
$attempt = 0
$ready = $false

while ($attempt -lt $maxAttempts -and -not $ready) {
    Start-Sleep -Seconds 3
    $attempt++
    try {
        $res = Invoke-WebRequest -Uri "http://localhost:$JenkinsPort/login" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($res.StatusCode -eq 200) {
            $ready = $true
        }
    } catch {
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
}

Write-Host ""
if ($ready) {
    Write-Success "Jenkins is accessible at http://localhost:$JenkinsPort"
    
    # Check for initial admin password
    try {
        $adminPassword = (docker exec jenkins-devops cat /var/jenkins_home/secrets/initialAdminPassword 2>$null)
        if ($adminPassword) {
            Write-Host "`n=======================================================" -ForegroundColor Yellow
            Write-Host "  JENKINS INITIAL ADMIN PASSWORD:" -ForegroundColor Yellow
            Write-Host "  $adminPassword" -ForegroundColor Green
            Write-Host "=======================================================`n" -ForegroundColor Yellow
        }
    } catch {
        # Already set up or skipped wizard
    }
} else {
    Write-Warn "Jenkins is still initializing. Check logs with: docker logs -f jenkins-devops"
}

# 5. Verify Docker connectivity from inside Jenkins container
Write-Step "Verifying Docker socket access from inside Jenkins container"
try {
    $dockerVerInside = (docker exec jenkins-devops docker version --format '{{.Server.Version}}' 2>$null)
    if ($dockerVerInside) {
        Write-Success "Docker inside Jenkins is connected to host Docker Engine (v$dockerVerInside) via group_add!"
    } else {
        throw "Could not reach Docker daemon from inside container."
    }
} catch {
    Write-Warn "Docker access check failed: $_"
}

# 6. Configure and verify Kubernetes connectivity inside Jenkins
Write-Step "Configuring and verifying Kubernetes connectivity inside Jenkins container"
try {
    $hostKubeConfig = Join-Path $HOME ".kube\config"
    if (Test-Path $hostKubeConfig) {
        # Copy and transform kubeconfig to use host.docker.internal
        $content = Get-Content $hostKubeConfig -Raw
        # Replace 127.0.0.1 with host.docker.internal and ensure TLS verify is handled
        $content = $content -replace "https://127.0.0.1:", "https://host.docker.internal:"
        
        # Write to container /var/jenkins_home/.kube/config
        $tmpKube = [System.IO.Path]::GetTempFileName()
        Set-Content -Path $tmpKube -Value $content
        docker cp $tmpKube "jenkins-devops:/var/jenkins_home/.kube/config"
        Remove-Item $tmpKube -Force
        
        # Strip certificate-authority-data and add insecure-skip-tls-verify
        docker exec jenkins-devops bash -c "sed -i '/certificate-authority-data/d' /var/jenkins_home/.kube/config && sed -i 's|server: https://host.docker.internal|server: https://host.docker.internal\n    insecure-skip-tls-verify: true|g' /var/jenkins_home/.kube/config"
    }

    $nodes = (docker exec jenkins-devops kubectl get nodes --no-headers 2>$null)
    if ($nodes) {
        Write-Success "Kubernetes connectivity confirmed: $nodes"
    } else {
        Write-Warn "Kubernetes cluster not reachable from inside container."
    }
} catch {
    Write-Warn "Kubernetes configuration had an issue: $_"
}

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "  JENKINS SETUP COMPLETE!" -ForegroundColor Green
Write-Host "  URL: http://localhost:$JenkinsPort" -ForegroundColor Cyan
Write-Host "=======================================================`n" -ForegroundColor Green
