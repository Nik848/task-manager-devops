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
        Write-Success "Docker inside Jenkins is connected to host Docker Engine (v$dockerVerInside)!"
    } else {
        Write-Warn "Could not verify Docker Engine from inside container. Checking socket permissions..."
        docker exec -u root jenkins-devops chmod 666 /var/run/docker.sock
        $dockerVerInside = (docker exec jenkins-devops docker version --format '{{.Server.Version}}')
        Write-Success "Permissions updated. Docker Engine connected: v$dockerVerInside"
    }
} catch {
    Write-Warn "Ensure /var/run/docker.sock is shared in Docker Desktop settings."
}

# 6. Verify kubectl from inside Jenkins
Write-Step "Verifying kubectl availability inside Jenkins container"
try {
    $kubeVer = (docker exec jenkins-devops kubectl version --client -o yaml 2>$null)
    Write-Success "kubectl is operational inside Jenkins."
} catch {
    Write-Warn "kubectl verification inside container had an issue: $_"
}

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "  JENKINS SETUP COMPLETE!" -ForegroundColor Green
Write-Host "  URL: http://localhost:$JenkinsPort" -ForegroundColor Cyan
Write-Host "=======================================================`n" -ForegroundColor Green
