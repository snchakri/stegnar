$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "[stegnar] Stopping stack and removing compose resources"
docker compose down -v --remove-orphans

Write-Host "[stegnar] Pruning images/build cache/volumes"
docker image prune -af
docker builder prune -af
docker volume prune -f

Write-Host "[stegnar] Cleanup complete"
