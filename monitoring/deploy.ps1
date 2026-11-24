# ==============================================================================
# Phase 7: Deploy Prometheus & Grafana Monitoring Stack
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host ">>> [1/5] Creating monitoring namespace..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\namespace.yaml"

Write-Host ">>> [2/5] Ensuring Metrics Server is installed..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\metrics-server.yaml"

Write-Host ">>> [3/5] Deploying Prometheus (RBAC, ConfigMap, Deployment, Service)..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\prometheus\rbac.yaml"
kubectl apply -f "$PSScriptRoot\prometheus\configmap.yaml"
kubectl apply -f "$PSScriptRoot\prometheus\deployment.yaml"
kubectl apply -f "$PSScriptRoot\prometheus\service.yaml"

Write-Host ">>> [4/5] Deploying Grafana (Secrets, Datasource, Dashboards, Service)..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\grafana\secret.yaml"
kubectl apply -f "$PSScriptRoot\grafana\configmap-datasources.yaml"
kubectl apply -f "$PSScriptRoot\grafana\configmap-dashboards.yaml"
kubectl apply -f "$PSScriptRoot\grafana\configmap-dashboard-json.yaml"
kubectl apply -f "$PSScriptRoot\grafana\deployment.yaml"
kubectl apply -f "$PSScriptRoot\grafana\service.yaml"

Write-Host ">>> [5/5] Waiting for monitoring deployments to become Ready..." -ForegroundColor Cyan
kubectl rollout status deployment/prometheus -n monitoring --timeout=120s
kubectl rollout status deployment/grafana -n monitoring --timeout=120s

Write-Host "`n=====================================================================" -ForegroundColor Green
Write-Host "  PROMETHEUS & GRAFANA MONITORING DEPLOYED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "`nTo access dashboards locally:"
Write-Host "  Grafana:    kubectl port-forward svc/grafana-service 3001:3000 -n monitoring"
Write-Host "              URL: http://localhost:3001  (User: admin / Pass: devops-monitoring-admin)"
Write-Host "  Prometheus: kubectl port-forward svc/prometheus-service 9090:9090 -n monitoring"
Write-Host "              URL: http://localhost:9090"
