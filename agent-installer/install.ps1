param(
    [Parameter(Mandatory=$true)]
    [string]$server
)

Write-Host "[STEGNAR] Installing Stegnar Agent..."

# 1. Download CA Cert
Write-Host "[STEGNAR] Fetching Server CA Certificate..."
$certPath = "$env:TEMP\stegnar-ca.crt"
Invoke-WebRequest -Uri "http://$server:8081/mitmproxy-ca-cert.pem" -OutFile $certPath

# Install to Root store
Import-Certificate -FilePath $certPath -CertStoreLocation Cert:\LocalMachine\Root

Write-Host "[STEGNAR] Installation Complete!"
