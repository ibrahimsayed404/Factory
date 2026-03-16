# PowerShell master installer for factory system
# Runs both backend and frontend setup scripts automatically
# Usage: Right-click and Run with PowerShell as Administrator

$ErrorActionPreference = 'Stop'

$factoryRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendScript = Join-Path $factoryRoot 'setup-factory-api-service.ps1'
$frontendScript = Join-Path $factoryRoot 'setup-factory-client-service.ps1'

Write-Host "Starting Factory System Setup..." -ForegroundColor Cyan

if (-not (Test-Path $backendScript)) {
    Write-Host "Backend setup script not found: $backendScript" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $frontendScript)) {
    Write-Host "Frontend setup script not found: $frontendScript" -ForegroundColor Red
    exit 1
}

Write-Host "\n--- Setting up Backend Service ---\n" -ForegroundColor Yellow
& $backendScript

Write-Host "\n--- Setting up Frontend Service ---\n" -ForegroundColor Yellow
& $frontendScript

Write-Host "\nAll services installed and started!" -ForegroundColor Green
Write-Host "You can now access the system via your browser."
Write-Host "To manage services, use NSSM or Windows Services Manager."
