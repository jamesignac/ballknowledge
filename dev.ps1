param([switch]$Build, [switch]$Test)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        $localNode = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot '.tools') -Directory -Filter 'node-v*-win-x64' -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $localNode) { throw 'Install Node.js 22 or newer, then run this script again.' }
        $env:Path = $localNode.FullName + ';' + $env:Path
    }
    if (-not (Test-Path -LiteralPath 'node_modules')) { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
    if ($Build) { & npm.cmd run build }
    elseif ($Test) { & npm.cmd test }
    else { & npm.cmd run dev }
    exit $LASTEXITCODE
} finally { Pop-Location }
