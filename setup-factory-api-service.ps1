# PowerShell script to automate backend service setup for factory-api
# - Installs NSSM if not present
# - Sets environment variables for the service
# - Registers the Node.js backend as a Windows service
# - Starts the service
#
# Usage: Run as Administrator in PowerShell

param(
    [string]$ServiceName = "factory-api",
    [string]$ApiDir = "C:\Users\ibrah\OneDrive\Desktop\factory\factory-api",
    [string]$NodeExe = "node",
    [string]$Entry = "src\index.js",
    [string]$NssmUrl = "https://nssm.cc/release/nssm-2.24.zip",
    [string]$NssmDir = "$env:ProgramFiles\nssm"
)

$ErrorActionPreference = 'Stop'

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

function Register-FactoryApiService {
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
    & $nssm install $ServiceName $NodeExe "$ApiDir\$Entry"
    & $nssm set $ServiceName AppDirectory $ApiDir
    & $nssm set $ServiceName AppStdout "$ApiDir\service.log"
    & $nssm set $ServiceName AppStderr "$ApiDir\service.err.log"
    & $nssm set $ServiceName AppStopMethodSkip 6
    # Set environment variables for the service
    & $nssm set $ServiceName AppEnvironmentExtra "JWT_SECRET=factory_local_dev_super_secret" "JWT_EXPIRES_IN=7d" "NODE_ENV=production" "DB_HOST=localhost" "DB_PORT=5432" "DB_NAME=factory_db"
    Write-Host "Service $ServiceName registered."
}

function Start-FactoryApiService {
    $nssm = Get-NssmPath
    Write-Host "Starting $ServiceName..."
    & $nssm start $ServiceName
    Write-Host "Service $ServiceName started."
}

# Main
Register-FactoryApiService
Start-FactoryApiService

Write-Host "\nService setup complete!"
Write-Host "To check status: nssm status $ServiceName"
Write-Host "To view logs: Get-Content -Tail 50 -Wait '$ApiDir\service.log'"
Write-Host "To stop: nssm stop $ServiceName"
Write-Host "To remove: nssm remove $ServiceName confirm"