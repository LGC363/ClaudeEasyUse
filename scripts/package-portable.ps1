$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host '==> Building renderer/main/preload'
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '==> Building Windows unpacked app'
npx electron-builder --win dir --config.npmRebuild=false
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$pkg = Get-Content package.json | ConvertFrom-Json
$version = $pkg.version
$unpackedDir = Join-Path $repoRoot 'release/win-unpacked'

if (!(Test-Path $unpackedDir)) {
  throw "Unpacked app directory not found: $unpackedDir"
}

$readmePath = Join-Path $unpackedDir 'README.txt'
$readme = @"
ClaudeEasyUse Windows Build

1. Keep Claude Code CLI installed on this PC.
2. Run ClaudeEasyUse.exe directly.
3. Optional path override for Claude CLI:
   set CLAUDE_PATH=C:\\Users\\<User>\\AppData\\Roaming\\npm\\claude.cmd

Notes:
- This package is portable: unzip and run directly.
- Logs are in %APPDATA%\\ClaudeEasyUse\\logs.
"@
$readme | Set-Content -Encoding utf8 $readmePath

$zipName = "ClaudeEasyUse-$version-win-x64-unpacked.zip"
$zipPath = Join-Path $repoRoot "release/$zipName"
if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Write-Host "==> Creating zip: $zipPath"
Compress-Archive -Path $unpackedDir -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host '==> Done'
Write-Host "EXE: $(Join-Path $unpackedDir 'ClaudeEasyUse.exe')"
Write-Host "ZIP: $zipPath"
