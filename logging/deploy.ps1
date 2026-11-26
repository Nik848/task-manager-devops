# ==============================================================================
# Phase 8: Deploy Centralized Logging with Fluentd + Loki
# ==============================================================================
$ErrorActionPreference = "Stop"

# ── 1. Build custom Fluentd image with Loki plugin ──────────────────────────
Write-Host ">>> [1/9] Building custom Fluentd image with Loki plugin..." -ForegroundColor Cyan
docker build -t fluentd-loki:v1.17-1 -f "$PSScriptRoot\Dockerfile" "$PSScriptRoot"

# ── 2. Create logging namespace ─────────────────────────────────────────────
Write-Host ">>> [2/9] Creating logging namespace..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\namespace.yaml"

# ── 3. Apply Fluentd ServiceAccount & RBAC ──────────────────────────────────
Write-Host ">>> [3/9] Applying Fluentd ServiceAccount & RBAC..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\rbac.yaml"

# ── 4. Deploy Loki (config, storage, deployment, service) ──────────────────
Write-Host ">>> [4/9] Deploying Loki log store..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\loki-configmap.yaml"
kubectl apply -f "$PSScriptRoot\loki-storage.yaml"
kubectl apply -f "$PSScriptRoot\loki-deployment.yaml"
kubectl apply -f "$PSScriptRoot\loki-service.yaml"

# ── 5. Deploy Fluentd DaemonSet ─────────────────────────────────────────────
Write-Host ">>> [5/9] Applying Fluentd ConfigMap & DaemonSet..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\configmap.yaml"
kubectl apply -f "$PSScriptRoot\daemonset.yaml"

# ── 6. Update Grafana datasources (adds Loki) ──────────────────────────────
Write-Host ">>> [6/9] Updating Grafana datasources (Prometheus + Loki)..." -ForegroundColor Cyan
$monitoringDir = (Resolve-Path "$PSScriptRoot\..\monitoring").Path
kubectl apply -f "$monitoringDir\grafana\configmap-datasources.yaml"

# ── 7. Generate and apply Grafana dashboard ConfigMap from standalone files ─
Write-Host ">>> [7/9] Generating Grafana dashboard ConfigMap from JSON files..." -ForegroundColor Cyan
kubectl create configmap grafana-dashboard-task-manager `
    --from-file=task-manager-overview.json="$monitoringDir\dashboards\dashboard-task-manager.json" `
    --from-file=task-manager-logs.json="$monitoringDir\dashboards\dashboard-task-manager-logs.json" `
    -n monitoring `
    --dry-run=client -o yaml | kubectl apply -f -

# ── 8. Restart Grafana to pick up new datasource ───────────────────────────
Write-Host ">>> [8/9] Restarting Grafana to load Loki datasource..." -ForegroundColor Cyan
kubectl rollout restart deployment/grafana -n monitoring

# ── 9. Wait for all rollouts ────────────────────────────────────────────────
Write-Host ">>> [9/9] Waiting for all rollouts to become Ready..." -ForegroundColor Cyan
kubectl rollout status deployment/loki -n logging --timeout=180s
kubectl rollout status daemonset/fluentd -n logging --timeout=180s
kubectl rollout status deployment/grafana -n monitoring --timeout=180s

Write-Host "`n=====================================================================" -ForegroundColor Green
Write-Host "  FLUENTD + LOKI CENTRALIZED LOGGING DEPLOYED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "`nTo access logs in Grafana:"
Write-Host "  kubectl port-forward svc/grafana-service 3001:3000 -n monitoring"
Write-Host "  URL: http://localhost:3001"
Write-Host "  Dashboard: Task Manager > Task Manager Logs"
Write-Host "`nTo inspect collected logs (file output):"
Write-Host "  kubectl exec -n logging ds/fluentd -- ls -la /var/log/fluentd-central/application"
Write-Host "  kubectl exec -n logging ds/fluentd -- ls -la /var/log/fluentd-central/infrastructure"
Write-Host "`nTo query Loki directly:"
Write-Host "  kubectl port-forward svc/loki 3100:3100 -n logging"
Write-Host "  curl http://localhost:3100/loki/api/v1/labels"
