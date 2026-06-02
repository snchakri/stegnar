# ==============================================================================
# Stegnar Forensic Agent — Local Node Testing Runner
# ==============================================================================
# Run this script in an Elevated PowerShell console (Run as Administrator).
# ==============================================================================

# 1. Verify Administrative Elevation
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "======================================================================"
    Write-Warning "[STEGNAR] WARNING: Not running as Administrator!"
    Write-Warning "Packet sniffing via Scapy requires administrator privileges."
    Write-Warning "Please restart this terminal as Administrator if sniffing fails."
    Write-Warning "======================================================================"
    Write-Host ""
}

# 2. Check for Python Installation
$pythonPath = (Get-Command python.exe -ErrorAction SilentlyContinue).Source
if (-not $pythonPath) {
    Write-Error "[STEGNAR] Error: Python was not found on this system. Please install Python 3.10+ and add it to PATH."
    exit 1
}

# 3. Setup Virtual Environment if not exists
$venvDir = "$PSScriptRoot\.venv"
if (-not (Test-Path $venvDir)) {
    Write-Host "[STEGNAR] Virtual environment not found. Creating it at $venvDir..." -ForegroundColor Cyan
    Start-Process -FilePath "python.exe" -ArgumentList "-m venv `"$venvDir`"" -Wait -NoNewWindow
}

# 4. Install/Update Dependencies
Write-Host "[STEGNAR] Ensuring dependencies are installed..." -ForegroundColor Cyan
Start-Process -FilePath "$venvDir\Scripts\pip.exe" -ArgumentList "install --upgrade pip" -Wait -NoNewWindow
Start-Process -FilePath "$venvDir\Scripts\pip.exe" -ArgumentList "install -r `"$PSScriptRoot\requirements.txt`"" -Wait -NoNewWindow

# 5. Configure Environment Variables
Write-Host "[STEGNAR] Configuring environment variables..." -ForegroundColor Cyan
$env:PYTHONPATH = $PSScriptRoot
$env:ROUTER_GRPC_ADDR = "localhost:50051"
$env:SOC_API_URL = "http://localhost:3001"
$env:CAPTURE_IFACE = "Wi-Fi"
$env:SSLKEYLOGFILE = "$env:TEMP\ssl_keys.log"
$env:ENDPOINT_ID = "WINDOWS-HOST"
$env:LOG_LEVEL = "INFO"

# 6. Run the Agent
Write-Host "[STEGNAR] Starting Stegnar Endpoint Agent (ENDPOINT_ID: WINDOWS-HOST, IFACE: Wi-Fi)..." -ForegroundColor Green
Write-Host "[STEGNAR] To intercept HTTPS, write SSL key logs to: $env:SSLKEYLOGFILE" -ForegroundColor Yellow
Write-Host "[STEGNAR] Press Ctrl+C to stop the agent." -ForegroundColor Yellow
Write-Host ""

& "$venvDir\Scripts\python.exe" "$PSScriptRoot\main.py"
