# PowerShell script to automate frontend (React) build and static server setup for factory-client
# - Installs serve (static file server) globally if not present
# - Builds the React frontend
# - Registers the static server as a Windows service using NSSM
# - Sets environment variables for the service
# - Starts the service
#
# Usage: Run as Administrator in PowerShell

param(
    [string]$ServiceName = "factory-client",
    [string]$ClientDir = "C:\Users\ibrah\OneDrive\Desktop\factory\factory-client",
    [string]$ServeExe = "serve",
    [string]$BuildDir = "build",
    [string]$Port = "3000",
    [string]$NssmDir = "$env:ProgramFiles\nssm"
)

$ErrorActionPreference = 'Stop'

function Ensure-Serve {
    if (-not (Get-Command serve -ErrorAction SilentlyContinue)) {
        Write-Host "Installing serve globally..."
        npm install -g serve
    } else {
        Write-Host "serve already installed."
    }
}

function Get-NssmPath {
    $localNssm = Join-Path $PSScriptRoot 'nssm.exe'
    if (Test-Path $localNssm) {
        Write-Host "Using local nssm.exe: $localNssm"
        return $localNssm
    }
    $nssmCmd = Get-Command nssm -ErrorAction SilentlyContinue
    if ($nssmCmd) {
        Write-Host "Using nssm from PATH: $($nssmCmd.Source)"
        return $nssmCmd.Source
    }
    throw "NSSM not found. Please place nssm.exe in the script folder or add to PATH."
}

function Build-Frontend {
    Write-Host "Building React frontend..."
    Push-Location $ClientDir
    npm install
    npm run build
    Pop-Location
}

function Register-FactoryClientService {
    $nssm = Get-NssmPath
    $svc = $null
    $statusOut = New-TemporaryFile
    $statusErr = New-TemporaryFile
    $proc = Start-Process -FilePath $nssm -ArgumentList @('status', $ServiceName) -NoNewWindow -Wait -PassThru -RedirectStandardOutput $statusOut -RedirectStandardError $statusErr
    $statusOutput = ((Get-Content $statusOut) + (Get-Content $statusErr) | Out-String).Trim().ToLower() -replace '[\r\n]+', ' '
    $statusOutput = $statusOutput -replace '\s+', ' '
    $serviceExists = ($proc.ExitCode -eq 0) -and ($statusOutput -like '*service_running*' -or $statusOutput -like '*service_stopped*')
    $statusClean = $statusOutput -replace '[^a-z!]', ''
    $serviceMissing = ($proc.ExitCode -ne 0) -and ($statusClean -like '*cantopenservice!*')
    Write-Host "[DEBUG] statusClean: [$statusClean]"
    Write-Host "[DEBUG] NSSM status exit code: $($proc.ExitCode)"
    Write-Host "[DEBUG] NSSM status output: [$statusOutput]"
    Write-Host "[DEBUG] serviceExists: $serviceExists"
    Write-Host "[DEBUG] serviceMissing: $serviceMissing"
    Remove-Item $statusOut, $statusErr -Force
    if ($serviceExists) {
        Write-Host "Service $ServiceName already exists. Removing..."
        & $nssm stop $ServiceName | Out-Null
        & $nssm remove $ServiceName confirm | Out-Null
    } elseif ($serviceMissing) {
        Write-Host "[DEBUG] NSSM service does not exist, proceeding."
        # Service does not exist, proceed
    } else {
        Write-Host "Unexpected error from nssm status: $statusOutput"
        throw "NSSM status error: $statusOutput"
    }
    Write-Host "Registering $ServiceName as a Windows service..."
    & $nssm install $ServiceName $ServeExe "-s $ClientDir\$BuildDir -l $Port"
    & $nssm set $ServiceName AppDirectory $ClientDir
    & $nssm set $ServiceName AppStdout "$ClientDir\service.log"
    & $nssm set $ServiceName AppStderr "$ClientDir\service.err.log"
    & $nssm set $ServiceName AppStopMethodSkip 6
    # Set environment variables for the service (add as needed)
    & $nssm set $ServiceName AppEnvironmentExtra "NODE_ENV=production"
    Write-Host "Service $ServiceName registered."
}

function Start-FactoryClientService {
    $nssm = Get-NssmPath
    Write-Host "Starting $ServiceName..."
    & $nssm start $ServiceName
    Write-Host "Service $ServiceName started."
}

# Main
Ensure-Serve
Build-Frontend
Register-FactoryClientService
Start-FactoryClientService

Write-Host "\nFrontend service setup complete!"
Write-Host "To check status: nssm status $ServiceName"
Write-Host "To view logs: Get-Content -Tail 50 -Wait '$ClientDir\service.log'"
Write-Host "To stop: nssm stop $ServiceName"
Write-Host "To remove: nssm remove $ServiceName confirm"