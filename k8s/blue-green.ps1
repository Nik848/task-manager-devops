<#
.SYNOPSIS
  Blue-Green Deployment Controller for Task Management System on Kubernetes.

.DESCRIPTION
  Supports deploying Blue or Green environments, independently verifying candidate
  health before switching traffic, switching Service selectors between Blue and Green,
  rolling back to Blue, and inspecting current Blue-Green status.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("status", "deploy-blue", "deploy-green", "switch-green", "rollback-blue")]
    [string]$Action,

    [string]$Namespace = "task-manager",
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ManifestDir = Join-Path $PSScriptRoot "blue-green"

function Write-Info($msg)    { Write-Host ">>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)      { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Fail($msg)    { Write-Host "[ERROR] $msg" -ForegroundColor Red }

function Get-DeploymentHealth {
    param([string]$Name)
    $raw = kubectl get deployment $Name -n $Namespace --ignore-not-found -o json 2>$null
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return [PSCustomObject]@{ Exists = $false; Desired = 0; Ready = 0; Available = 0; Healthy = $false; Image = "N/A" }
    }
    $obj = $raw | ConvertFrom-Json
    $desired   = [int]($obj.spec.replicas)
    $ready     = [int]($obj.status.readyReplicas)
    $available = [int]($obj.status.availableReplicas)
    $image     = $obj.spec.template.spec.containers[0].image
    $healthy   = ($desired -gt 0) -and ($ready -eq $desired) -and ($available -eq $desired)
    return [PSCustomObject]@{
        Exists    = $true
        Desired   = $desired
        Ready     = $ready
        Available = $available
        Healthy   = $healthy
        Image     = $image
    }
}

function Get-ServiceSelectorColor {
    param([string]$ServiceName)
    $raw = kubectl get service $ServiceName -n $Namespace -o json
    $obj = $raw | ConvertFrom-Json
    $ver = $obj.spec.selector.version
    if ([string]::IsNullOrWhiteSpace($ver)) { return "legacy (unversioned)" }
    return $ver
}

function Assert-ColorReady {
    param([string]$Color)
    $be = Get-DeploymentHealth "backend-$Color"
    $fe = Get-DeploymentHealth "frontend-$Color"
    if (-not $be.Exists -or -not $fe.Exists) {
        throw "Safety check failed: '$Color' deployments do not exist (backend-$Color exists=$($be.Exists), frontend-$Color exists=$($fe.Exists)). Traffic switch aborted."
    }
    if (-not $be.Healthy -or -not $fe.Healthy) {
        throw "Safety check failed: '$Color' deployments are not Ready (backend-$Color=$($be.Ready)/$($be.Desired), frontend-$Color=$($fe.Ready)/$($fe.Desired)). Traffic switch aborted."
    }
}

function Verify-CandidateIndependently {
    param([string]$Color)
    Write-Info "Verifying '$Color' backend and frontend independently via port-forward..."
    $beJob = Start-Process -FilePath "kubectl" -ArgumentList @("port-forward", "deployment/backend-$Color", "13000:3000", "-n", $Namespace) -PassThru -WindowStyle Hidden
    $feJob = Start-Process -FilePath "kubectl" -ArgumentList @("port-forward", "deployment/frontend-$Color", "18080:80", "-n", $Namespace) -PassThru -WindowStyle Hidden
    try {
        Start-Sleep -Seconds 3
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:13000/health" -TimeoutSec 10
        if ($health.status -ne "ok" -or $health.db -ne "connected") {
            throw "Candidate backend-$Color /health check failed: $($health | ConvertTo-Json -Compress)"
        }
        Write-Ok "Candidate backend-${Color} /health: status=$($health.status), db=$($health.db)"

        $feResp = Invoke-WebRequest -Uri "http://127.0.0.1:18080/" -UseBasicParsing -TimeoutSec 10
        if ($feResp.StatusCode -ne 200) {
            throw "Candidate frontend-$Color returned HTTP $($feResp.StatusCode)"
        }
        Write-Ok "Candidate frontend-${Color} HTTP: $($feResp.StatusCode)"
    } finally {
        if ($beJob -and -not $beJob.HasExited) { Stop-Process -Id $beJob.Id -Force -ErrorAction SilentlyContinue }
        if ($feJob -and -not $feJob.HasExited) { Stop-Process -Id $feJob.Id -Force -ErrorAction SilentlyContinue }
    }
}

function Verify-ProductionEntrypoint {
    Write-Info "Verifying production entry point (http://localhost)..."
    $health = Invoke-RestMethod -Uri "http://localhost/health" -TimeoutSec 10
    if ($health.status -ne "ok" -or $health.db -ne "connected") {
        throw "Production /health check failed."
    }
    Write-Ok "Production /health: status=$($health.status), db=$($health.db)"

    $feResp = Invoke-WebRequest -Uri "http://localhost/" -UseBasicParsing -TimeoutSec 10
    if ($feResp.StatusCode -ne 200) {
        throw "Production frontend returned HTTP $($feResp.StatusCode)"
    }
    Write-Ok "Production frontend HTTP: $($feResp.StatusCode)"
}

function Switch-TrafficTo {
    param([string]$Color)
    Assert-ColorReady $Color

    Write-Info "Switching backend-service and frontend-service selectors to version=$Color..."
    kubectl set selector service backend-service "app=backend,version=$Color" -n $Namespace | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to update backend-service selector." }
    kubectl set selector service frontend-service "app=frontend,version=$Color" -n $Namespace | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to update frontend-service selector." }

    Start-Sleep -Seconds 2
    Write-Info "Verifying Service endpoints point to '$Color' pods..."
    kubectl get endpoints backend-service frontend-service -n $Namespace
    kubectl get pods -n $Namespace -l "version=$Color" -o wide
    Verify-ProductionEntrypoint
    Write-Ok "Active production traffic is now routed to: $Color"
}

switch ($Action) {
    "status" {
        $beBlue  = Get-DeploymentHealth "backend-blue"
        $feBlue  = Get-DeploymentHealth "frontend-blue"
        $beGreen = Get-DeploymentHealth "backend-green"
        $feGreen = Get-DeploymentHealth "frontend-green"
        $beColor = Get-ServiceSelectorColor "backend-service"
        $feColor = Get-ServiceSelectorColor "frontend-service"

        Write-Host "`n=== BLUE-GREEN DEPLOYMENT STATUS ($Namespace) ===" -ForegroundColor Yellow
        Write-Host "Active Service Selectors : backend-service -> $beColor | frontend-service -> $feColor"
        Write-Host ("Blue  (backend-blue)     : Exists={0}, Ready={1}/{2}, Available={3}, Image={4}" -f $beBlue.Exists, $beBlue.Ready, $beBlue.Desired, $beBlue.Available, $beBlue.Image)
        Write-Host ("Blue  (frontend-blue)    : Exists={0}, Ready={1}/{2}, Available={3}, Image={4}" -f $feBlue.Exists, $feBlue.Ready, $feBlue.Desired, $feBlue.Available, $feBlue.Image)
        Write-Host ("Green (backend-green)    : Exists={0}, Ready={1}/{2}, Available={3}, Image={4}" -f $beGreen.Exists, $beGreen.Ready, $beGreen.Desired, $beGreen.Available, $beGreen.Image)
        Write-Host ("Green (frontend-green)   : Exists={0}, Ready={1}/{2}, Available={3}, Image={4}" -f $feGreen.Exists, $feGreen.Ready, $feGreen.Desired, $feGreen.Available, $feGreen.Image)
        Write-Host ""
    }

    "deploy-blue" {
        Write-Info "Deploying Blue environment (stable)..."
        kubectl apply -f (Join-Path $ManifestDir "backend-blue.yaml")
        kubectl apply -f (Join-Path $ManifestDir "frontend-blue.yaml")
        kubectl rollout status deployment/backend-blue -n $Namespace --timeout=180s
        kubectl rollout status deployment/frontend-blue -n $Namespace --timeout=180s
        Switch-TrafficTo "blue"
    }

    "deploy-green" {
        if (-not $SkipBuild) {
            Write-Info "Building Green candidate images (v2.0.0-green)..."
            docker build -t taskmanager-backend:v2.0.0-green (Join-Path $RepoRoot "app\backend")
            docker build -t taskmanager-frontend:v2.0.0-green (Join-Path $RepoRoot "app\frontend")
        }
        Write-Info "Deploying Green candidate environment (without switching traffic)..."
        kubectl apply -f (Join-Path $ManifestDir "backend-green.yaml")
        kubectl apply -f (Join-Path $ManifestDir "frontend-green.yaml")
        kubectl rollout status deployment/backend-green -n $Namespace --timeout=180s
        kubectl rollout status deployment/frontend-green -n $Namespace --timeout=180s
        Verify-CandidateIndependently "green"
        $activeColor = Get-ServiceSelectorColor "frontend-service"
        Write-Ok "Green candidate is Ready and verified. Production traffic remains on: $activeColor"
    }

    "switch-green" {
        Switch-TrafficTo "green"
    }

    "rollback-blue" {
        Write-Info "Initiating rollback to Blue..."
        Switch-TrafficTo "blue"
        Write-Ok "Rollback to Blue completed successfully."
    }
}
