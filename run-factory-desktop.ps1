# PowerShell script to run the Factory desktop app as a true desktop application
# - Builds the React app with the correct API URL for Electron
# - Starts the backend API server
# - Launches the Electron desktop app
# Usage: Right-click and Run with PowerShell as Administrator

$ErrorActionPreference = 'Stop'

$factoryRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$clientDir = Join-Path $factoryRoot 'factory-client'
$apiDir = Join-Path $factoryRoot 'factory-api'
$desktopDir = Join-Path $factoryRoot 'factory-desktop'

Write-Host "Building React app with correct API URL..." -ForegroundColor Cyan
Push-Location $clientDir
$env:REACT_APP_API_URL = 'http://localhost:5000/api'
npm install
npm run build
Pop-Location

Write-Host "\nStarting backend API server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$apiDir`"; npm install; npm start" -WindowStyle Minimized

Start-Sleep -Seconds 4

Write-Host "\nLaunching Electron desktop app..." -ForegroundColor Green
Push-Location $desktopDir
npx electron .
Pop-Location

Write-Host "\nFactory desktop app is running!" -ForegroundColor Green
