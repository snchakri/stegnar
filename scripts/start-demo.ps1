param(
    [switch]$Reset,
    [string]$RunName = "run-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$runtimeRoot = Join-Path $root "runtime\runs\$RunName"
$proofRoot = Join-Path $runtimeRoot "proofs"

Write-Host "[stegnar] Runtime root: $runtimeRoot"

$dirs = @(
    "$runtimeRoot",
    "$runtimeRoot\redis",
    "$runtimeRoot\postgres",
    "$runtimeRoot\minio",
    "$runtimeRoot\proxy",
    "$runtimeRoot\soc-api-tmp",
    "$runtimeRoot\sender-state\node-1",
    "$runtimeRoot\sender-state\node-2",
    "$runtimeRoot\sender-state\node-3",
    "$runtimeRoot\sender-state\node-4",
    "$runtimeRoot\sender-state\node-5",
    "$runtimeRoot\sender-state\node-6",
    "$runtimeRoot\sender-state\node-7",
    "$runtimeRoot\sender-state\node-8",
    "$proofRoot\node-9",
    "$proofRoot\node-10",
    "$proofRoot\node-11",
    "$proofRoot\node-12",
    "$proofRoot\node-13",
    "$proofRoot\node-14",
    "$proofRoot\node-15",
    "$proofRoot\node-16"
)

foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

$runtimeDirForCompose = "./runtime/runs/$RunName"
$envFile = Join-Path $root ".env.runtime"

$envLines = @("RUNTIME_DIR=$runtimeDirForCompose")
$exampleEnv = Join-Path $root ".env.runtime.example"
if (Test-Path $exampleEnv) {
    $exampleLines = Get-Content $exampleEnv | Where-Object {
        $_ -and -not $_.Trim().StartsWith("#") -and -not $_.Trim().StartsWith("RUNTIME_DIR=")
    }
    $envLines += $exampleLines
}
Set-Content -Path $envFile -Value (($envLines -join "`n") + "`n") -Encoding UTF8

if ($Reset) {
    Write-Host "[stegnar] Reset requested: stopping stack + pruning docker artifacts"
    docker compose --env-file .env.runtime down -v --remove-orphans
    docker image prune -af
    docker builder prune -af
    docker volume prune -f
}

Write-Host "[stegnar] Starting stack with runtime dir: $runtimeDirForCompose"
docker compose --env-file .env.runtime up -d --build

Write-Host "[stegnar] Active runtime path: runtime/runs/$RunName"
Write-Host "[stegnar] Receiver proofs: runtime/runs/$RunName/proofs"
