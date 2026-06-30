# Read-only monthly audit of video availability. Runs check_private.js inside the
# app container and writes a timestamped log to logs/. Does NOT delete anything —
# review the log, then run `node tools/cleanup_videos.js --apply` if you want to
# act on it. Registered as a Windows Scheduled Task by setup_audit_task.ps1.

$ErrorActionPreference = 'Stop'
$root    = Split-Path $PSScriptRoot -Parent
$logDir  = Join-Path $root 'logs'
$stamp   = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$logFile = Join-Path $logDir "video_audit_$stamp.log"

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

Set-Location $root

# Bail gracefully if Docker/the app container isn't running.
$running = docker compose ps --status running --services 2>$null
if ($LASTEXITCODE -ne 0 -or ($running -notcontains 'app')) {
  "[$stamp] app container not running — skipped audit." | Out-File -FilePath $logFile -Encoding utf8
  exit 0
}

"[$stamp] Running video availability audit..." | Out-File -FilePath $logFile -Encoding utf8
docker compose exec -T app node tools/check_private.js 2>&1 |
  Where-Object { $_ -notmatch 'DeprecationWarning|trace-deprecation|mpromise' } |
  Out-File -FilePath $logFile -Append -Encoding utf8

# Prune to the 12 most recent audit logs.
Get-ChildItem $logDir -Filter 'video_audit_*.log' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 12 |
  Remove-Item -Force -ErrorAction SilentlyContinue
