# ==============================================================================
# Phase 7: Deploy Prometheus & Grafana Monitoring Stack
# ==============================================================================
$ErrorActionPreference = "Stop"

# --- Security Check: Require GRAFANA_ADMIN_PASSWORD ---
$grafanaPassword = $env:GRAFANA_ADMIN_PASSWORD
if ([string]::IsNullOrWhiteSpace($grafanaPassword)) {
    Write-Error "CRITICAL SECURITY ERROR: The environment variable GRAFANA_ADMIN_PASSWORD is required but not set.`nPlease set it before running this deployment script, e.g.:`n  `$env:GRAFANA_ADMIN_PASSWORD='YourStrongPasswordHere'`nDeployment halted."
    exit 1
}

Write-Host ">>> [1/6] Creating monitoring namespace..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\namespace.yaml"

Write-Host ">>> [2/6] Ensuring Metrics Server is installed..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\metrics-server.yaml"

Write-Host ">>> [3/6] Deploying kube-state-metrics (Cluster & Pod State)..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\kube-state-metrics\rbac.yaml"
kubectl apply -f "$PSScriptRoot\kube-state-metrics\deployment.yaml"
kubectl apply -f "$PSScriptRoot\kube-state-metrics\service.yaml"

Write-Host ">>> [4/6] Deploying Prometheus (RBAC, ConfigMap, Deployment, Service)..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\prometheus\rbac.yaml"
kubectl apply -f "$PSScriptRoot\prometheus\configmap.yaml"
kubectl apply -f "$PSScriptRoot\prometheus\deployment.yaml"
kubectl apply -f "$PSScriptRoot\prometheus\service.yaml"

Write-Host ">>> [5/6] Provisioning Grafana Secret & Deploying Grafana Stack..." -ForegroundColor Cyan
# Dynamically create or update Secret without exposing password in console
kubectl create secret generic grafana-secret `
    --from-literal=admin-user="admin" `
    --from-literal=admin-password="$grafanaPassword" `
    -n monitoring `
    --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f "$PSScriptRoot\grafana\configmap-datasources.yaml"
kubectl apply -f "$PSScriptRoot\grafana\configmap-dashboards.yaml"

# Generate dashboard ConfigMap from standalone JSON files (single source of truth)
$dashboardDir = "$PSScriptRoot\dashboards"
$fromFileArgs = @("--from-file=task-manager-overview.json=$dashboardDir\dashboard-task-manager.json")
if (Test-Path "$dashboardDir\dashboard-task-manager-logs.json") {
    $fromFileArgs += "--from-file=task-manager-logs.json=$dashboardDir\dashboard-task-manager-logs.json"
}
kubectl create configmap grafana-dashboard-task-manager `
    $fromFileArgs `
    -n monitoring `
    --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f "$PSScriptRoot\grafana\deployment.yaml"
kubectl apply -f "$PSScriptRoot\grafana\service.yaml"

Write-Host ">>> [6/6] Waiting for monitoring deployments to become Ready..." -ForegroundColor Cyan
kubectl rollout status deployment/metrics-server -n kube-system --timeout=120s
kubectl rollout status deployment/kube-state-metrics -n monitoring --timeout=120s
kubectl rollout status deployment/prometheus -n monitoring --timeout=120s
kubectl rollout status deployment/grafana -n monitoring --timeout=120s

Write-Host "`n=====================================================================" -ForegroundColor Green
Write-Host "  PROMETHEUS & GRAFANA MONITORING DEPLOYED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "`nTo access dashboards locally:"
Write-Host "  Grafana:    kubectl port-forward svc/grafana-service 3001:3000 -n monitoring"
Write-Host "              URL: http://localhost:3001  (User: admin / Pass: [configured in `$env:GRAFANA_ADMIN_PASSWORD])"
Write-Host "  Prometheus: kubectl port-forward svc/prometheus-service 9090:9090 -n monitoring"
Write-Host "              URL: http://localhost:9090"
