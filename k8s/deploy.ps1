<#
.SYNOPSIS
  Deploy Task Management System to local or remote Kubernetes cluster.

.DESCRIPTION
  This script validates prerequisites, applies all Kubernetes manifests in order,
  provisions secrets, waits for rollouts, and outputs endpoint status.
#>

[CmdletBinding()]
param (
    [string]$Namespace = "task-manager",
    [switch]$IncludeIngress = $false
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n=== [STEP] $Message ===" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

# 1. Verify kubectl is available
Write-Step "Checking kubectl prerequisite"
if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
    throw "kubectl command not found. Please install kubectl and ensure it is in your PATH."
}
$clusterContext = (kubectl config current-context)
Write-Success "kubectl is available. Target Cluster Context: $clusterContext"

# 2. Apply Namespace
Write-Step "Creating / Verifying Namespace: $Namespace"
kubectl apply -f "$PSScriptRoot/namespace.yaml"
Write-Success "Namespace '$Namespace' ensured."

# 3. Apply ConfigMap
Write-Step "Applying ConfigMap"
kubectl apply -f "$PSScriptRoot/configmap.yaml"
Write-Success "ConfigMap applied."

# 4. Handle Secret
Write-Step "Applying Secret"
$backendEnvPath = Join-Path $PSScriptRoot "../app/backend/.env"
$secretExists = (kubectl get secret task-manager-secret -n $Namespace --ignore-not-found -o jsonpath="{.metadata.name}")

if (-not [string]::IsNullOrEmpty($secretExists)) {
    Write-Success "Secret 'task-manager-secret' already exists in namespace '$Namespace'."
} elseif (Test-Path $backendEnvPath) {
    Write-Host "Found local app/backend/.env - extracting credentials for task-manager-secret..." -ForegroundColor Gray
    
    # Extract values from .env (no hardcoded defaults for any secret or admin credential)
    $dbUrl = ""
    $jwtSecret = ""
    $adminEmail = ""
    $adminPass = ""

    Get-Content $backendEnvPath | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $parts = $line.Split("=", 2)
            if ($parts.Length -eq 2) {
                $key = $parts[0].Trim()
                $val = $parts[1].Trim()
                switch ($key) {
                    "DATABASE_URL" { $dbUrl = $val }
                    "JWT_SECRET" { $jwtSecret = $val }
                    "ADMIN_EMAIL" { $adminEmail = $val }
                    "ADMIN_PASSWORD" { $adminPass = $val }
                }
            }
        }
    }

    $missingKeys = @()
    if ([string]::IsNullOrWhiteSpace($dbUrl)) { $missingKeys += "DATABASE_URL" }
    if ([string]::IsNullOrWhiteSpace($jwtSecret)) { $missingKeys += "JWT_SECRET" }
    if ([string]::IsNullOrWhiteSpace($adminEmail)) { $missingKeys += "ADMIN_EMAIL" }
    if ([string]::IsNullOrWhiteSpace($adminPass)) { $missingKeys += "ADMIN_PASSWORD" }

    if ($missingKeys.Count -eq 0) {
        kubectl create secret generic task-manager-secret `
            --namespace=$Namespace `
            --from-literal="DATABASE_URL=$dbUrl" `
            --from-literal="JWT_SECRET=$jwtSecret" `
            --from-literal="ADMIN_EMAIL=$adminEmail" `
            --from-literal="ADMIN_PASSWORD=$adminPass" `
            --dry-run=client -o yaml | kubectl apply -f - | Out-Null
        Write-Success "Created 'task-manager-secret' from app/backend/.env"
    } else {
        throw "Missing or empty required credentials in app/backend/.env: $($missingKeys -join ', '). Deployment halted to avoid provisioning incomplete or default credentials."
    }
} else {
    throw "Secret 'task-manager-secret' does not exist in namespace '$Namespace' and app/backend/.env was not found. Provision the Secret securely before deploying."
}

# 5. Apply Persistent Volume & Persistent Volume Claim
Write-Step "Applying PV and PVC"
kubectl apply -f "$PSScriptRoot/task-manager-pv.yaml"
kubectl apply -f "$PSScriptRoot/task-manager-pvc.yaml"
Write-Success "PV and PVC applied."

# 6. Apply RBAC
Write-Step "Applying RBAC resources"
kubectl apply -f "$PSScriptRoot/rbac.yaml"
Write-Success "RBAC resources applied."

# 7. Apply Services (preserve active Blue-Green selector if already set)
Write-Step "Applying Services (Backend ClusterIP & Frontend LoadBalancer)"
$beVer = (kubectl get service backend-service -n $Namespace --ignore-not-found -o jsonpath="{.spec.selector.version}")
if ([string]::IsNullOrWhiteSpace($beVer)) {
    kubectl apply -f "$PSScriptRoot/backend-service.yaml"
} else {
    Write-Host "Preserving active Blue-Green selector (version=$beVer) on backend-service." -ForegroundColor Gray
}
$feVer = (kubectl get service frontend-service -n $Namespace --ignore-not-found -o jsonpath="{.spec.selector.version}")
if ([string]::IsNullOrWhiteSpace($feVer)) {
    kubectl apply -f "$PSScriptRoot/frontend-service.yaml"
} else {
    Write-Host "Preserving active Blue-Green selector (version=$feVer) on frontend-service." -ForegroundColor Gray
}
Write-Success "Services configured."

# 8. Apply Ingress (Optional Bonus Feature)
if ($IncludeIngress) {
    Write-Step "Applying Ingress"
    kubectl apply -f "$PSScriptRoot/ingress.yaml"
    Write-Success "Ingress applied (Host: task-manager.local)."
}

# 9. Apply Deployments
Write-Step "Applying Deployments (Backend & Frontend)"
kubectl apply -f "$PSScriptRoot/backend-deployment.yaml"
kubectl apply -f "$PSScriptRoot/frontend-deployment.yaml"
Write-Success "Deployments applied."

# 10. Wait for rollout status
Write-Step "Waiting for deployments to roll out successfully..."
kubectl rollout status deployment/backend -n $Namespace --timeout=180s
kubectl rollout status deployment/frontend -n $Namespace --timeout=180s
Write-Success "All pods are running and healthy!"

# 11. Display status summary
Write-Step "Deployment Summary"
Write-Host "`nPods:" -ForegroundColor White
kubectl get pods -n $Namespace -o wide

Write-Host "`nServices:" -ForegroundColor White
kubectl get svc -n $Namespace

Write-Host "`nPVCs:" -ForegroundColor White
kubectl get pvc -n $Namespace

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "  TASK MANAGER KUBERNETES DEPLOYMENT COMPLETED!" -ForegroundColor Green
Write-Host "  Access Frontend via: http://localhost (or http://localhost:30080)" -ForegroundColor Yellow
Write-Host "  Backend Service: http://backend-service:3000 (Internal ClusterIP)" -ForegroundColor Yellow
Write-Host "=======================================================`n" -ForegroundColor Green
