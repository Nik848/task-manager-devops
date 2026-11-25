# ==============================================================================
# Phase 8: Deploy Centralized Logging with Fluentd
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host ">>> [1/5] Creating logging namespace..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\namespace.yaml"

Write-Host ">>> [2/5] Applying Fluentd ServiceAccount & RBAC..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\rbac.yaml"

Write-Host ">>> [3/5] Applying Fluentd ConfigMap..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\configmap.yaml"

Write-Host ">>> [4/5] Deploying Fluentd DaemonSet..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\daemonset.yaml"

Write-Host ">>> [5/5] Waiting for Fluentd DaemonSet to become Ready..." -ForegroundColor Cyan
kubectl rollout status daemonset/fluentd -n logging --timeout=180s

Write-Host "`n=====================================================================" -ForegroundColor Green
Write-Host "  FLUENTD CENTRALIZED LOGGING DEPLOYED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "`nTo inspect collected logs:"
Write-Host "  kubectl get pods -n logging"
Write-Host "  kubectl exec -n logging ds/fluentd -- ls -la /var/log/fluentd-central/application"
Write-Host "  kubectl exec -n logging ds/fluentd -- ls -la /var/log/fluentd-central/infrastructure"
