# Starts both Task Manager Backend and Frontend simultaneously
Write-Host "Starting Task Manager Backend and Frontend..." -ForegroundColor Cyan

# Start Backend in background process
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\app\backend'; Write-Host '--- BACKEND (Port 3000) ---' -ForegroundColor Green; npm run dev"

# Start Frontend in background process
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\app\frontend'; Write-Host '--- FRONTEND (Port 5173) ---' -ForegroundColor Green; npm run dev"

Write-Host "Both servers are starting up!" -ForegroundColor Green
Write-Host "Backend API:  http://localhost:3000"
Write-Host "Frontend App: http://localhost:5173"
