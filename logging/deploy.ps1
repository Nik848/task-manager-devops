# ==============================================================================
# Phase 8: Deploy Centralized Logging with Fluentd
# ==============================================================================
$ErrorActionPreference = "Stop"

# ── 1. Create logging namespace ─────────────────────────────────────────────
Write-Host ">>> [1/4] Creating logging namespace..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\namespace.yaml"

# ── 2. Apply Fluentd ServiceAccount & RBAC ──────────────────────────────────
Write-Host ">>> [2/4] Applying Fluentd ServiceAccount & RBAC..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\rbac.yaml"

# ── 3. Deploy Fluentd ConfigMap & DaemonSet ────────────────────────────────
Write-Host ">>> [3/4] Applying Fluentd ConfigMap & DaemonSet..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\configmap.yaml"
kubectl apply -f "$PSScriptRoot\daemonset.yaml"

# ── 4. Wait for rollout ────────────────────────────────────────────────────
Write-Host ">>> [4/4] Waiting for Fluentd DaemonSet to become Ready..." -ForegroundColor Cyan
kubectl rollout status daemonset/fluentd -n logging --timeout=180s

Write-Host "`n=====================================================================" -ForegroundColor Green
Write-Host "  FLUENTD CENTRALIZED LOGGING DEPLOYED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "`nTo inspect collected logs:"
Write-Host "  kubectl exec -n logging ds/fluentd -- ls -la /var/log/fluentd-central/application"
Write-Host "  kubectl exec -n logging ds/fluentd -- ls -la /var/log/fluentd-central/infrastructure"
