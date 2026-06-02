# ==============================================================================
# Stegnar Forensic Agent — Native Windows Installation Script
# ==============================================================================
# This script executes a low-footprint, native background service install.
# Usage (run in Elevated PowerShell console):
# powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((New-Object System.Net.WebClient).DownloadString('http://<server-ip>:8081/install.ps1'))"
# ==============================================================================

$serverIp = "__SERVER_IP_PLACEHOLDER__"
$installDir = "C:\Program Files\Stegnar\Agent"
$certPath = "$env:TEMP\stegnar-ca.crt"
$zipPath = "$env:TEMP\agent.zip"

# 1. Verify Administrative Elevation
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "[STEGNAR] Error: Please run this script from an elevated PowerShell console (Run as Administrator)."
    exit 1
}

Write-Host "[STEGNAR] Initiating native Windows Stegnar Agent installation..." -ForegroundColor Green

# 2. Check for Python Installation
$pythonPath = (Get-Command python.exe -ErrorAction SilentlyContinue).Source
if (-not $pythonPath) {
    Write-Host "[STEGNAR] Error: Python was not found on this system. Please install Python 3.10+ (and add it to PATH) before proceeding." -ForegroundColor Red
    exit 1
}
Write-Host "[STEGNAR] Found Python: $pythonPath" -ForegroundColor Cyan

# 3. Download and Install CA Certificate
Write-Host "[STEGNAR] Fetching Server CA Certificate..." -ForegroundColor Cyan
Invoke-WebRequest -Uri "http://$($serverIp):8081/mitmproxy-ca-cert.pem" -OutFile $certPath -UseBasicParsing
Import-Certificate -FilePath $certPath -CertStoreLocation Cert:\LocalMachine\Root
Remove-Item -Force $certPath

# 4. Download and Extract Agent Source ZIP
Write-Host "[STEGNAR] Downloading agent source code..." -ForegroundColor Cyan
if (Test-Path $installDir) {
    Remove-Item -Recurse -Force $installDir
}
New-Item -ItemType Directory -Path $installDir -Force | Out-Null
Invoke-WebRequest -Uri "http://$($serverIp):8081/agent.zip" -OutFile $zipPath -UseBasicParsing
Expand-Archive -Path $zipPath -DestinationPath $installDir -Force
Remove-Item -Force $zipPath

# 5. Create Virtual Environment and Install Dependencies
Write-Host "[STEGNAR] Building local Python isolated environment..." -ForegroundColor Cyan
Start-Process -FilePath "python.exe" -ArgumentList "-m venv `"$installDir\venv`"" -Wait -NoNewWindow
Start-Process -FilePath "$installDir\venv\Scripts\pip.exe" -ArgumentList "install --upgrade pip" -Wait -NoNewWindow
Start-Process -FilePath "$installDir\venv\Scripts\pip.exe" -ArgumentList "install -r `"$installDir\endpoint-agent\requirements.txt`"" -Wait -NoNewWindow

# 6. Configure Environment Variables via Registry / Startup Wrapper
# We write a launcher script to inject standard agent environmental mappings
Write-Host "[STEGNAR] Configuring service configuration..." -ForegroundColor Cyan
$launcherPath = "$installDir\run-agent.ps1"
$launcherContent = @"
`$env:PYTHONPATH = "$installDir"
`$env:ROUTER_GRPC_ADDR = "$($serverIp):50051"
`$env:CAPTURE_IFACE = "Ethernet"
`$env:SSLKEYLOGFILE = "$env:USERPROFILE\AppData\Local\Temp\ssl_keys.log"
`$env:ENDPOINT_ID = "`$env:COMPUTERNAME"

& "$installDir\venv\Scripts\python.exe" "$installDir\endpoint-agent\main.py"
"@
Set-Content -Path $launcherPath -Value $launcherContent -Force

# 7. Register Native Windows Startup Task (Zero SCM Timeout Bypass)
Write-Host "[STEGNAR] Registering native Windows background startup task..." -ForegroundColor Cyan
$taskName = "StegnarAgent"

# Clean existing task if present
Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$false | Out-Null

$trigger = New-ScheduledTaskTrigger -AtStartup
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -File `"$launcherPath`""
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $taskName -Trigger $trigger -Action $action -Settings $settings -User "SYSTEM" -RunLevel Highest -Force | Out-Null

# Start the task immediately
Start-ScheduledTask -TaskName $taskName

Write-Host "[STEGNAR] Native Windows installation completed successfully!" -ForegroundColor Green
Write-Host "[STEGNAR] Stegnar agent is running in the background as a Scheduled Task (SYSTEM)." -ForegroundColor Green
