$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host '==> Building renderer/main/preload'
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '==> Building Windows portable exe'
npx electron-builder --win portable --config.npmRebuild=false
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$pkg = Get-Content package.json | ConvertFrom-Json
$version = $pkg.version
$exeName = "ClaudeEasyUse-$version-portable.exe"
$exePath = Join-Path $repoRoot "release/$exeName"

if (!(Test-Path $exePath)) {
  throw "Portable executable not found: $exePath"
}

$bundleRoot = Join-Path $repoRoot 'release/portable-bundle'
if (Test-Path $bundleRoot) {
  Remove-Item -LiteralPath $bundleRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $bundleRoot | Out-Null

$bundleAppDir = Join-Path $bundleRoot 'ClaudeEasyUse'
New-Item -ItemType Directory -Path $bundleAppDir | Out-Null
Copy-Item -LiteralPath $exePath -Destination (Join-Path $bundleAppDir 'ClaudeEasyUse.exe') -Force

$readme = @"
ClaudeEasyUse Portable

1. Keep Claude Code CLI installed on this PC.
2. Double-click ClaudeEasyUse.exe to run.
3. Optional path override for Claude CLI:
   set CLAUDE_PATH=C:\\Users\\<User>\\AppData\\Roaming\\npm\\claude.cmd

Notes:
- This package is portable: unzip and run directly.
- Logs are in %APPDATA%\\ClaudeEasyUse\\logs.
"@
$readme | Set-Content -Encoding utf8 (Join-Path $bundleAppDir 'README.txt')

$zipName = "ClaudeEasyUse-$version-win-x64-portable.zip"
$zipPath = Join-Path $repoRoot "release/$zipName"
if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Write-Host "==> Creating zip: $zipPath"
Compress-Archive -Path (Join-Path $bundleRoot '*') -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host '==> Done'
Write-Host "EXE: $exePath"
Write-Host "ZIP: $zipPath"
