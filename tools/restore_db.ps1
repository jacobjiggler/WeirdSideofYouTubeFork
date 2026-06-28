<#
  Restores the weirdtube MongoDB from a gzip archive produced by backup_db.ps1.

  Usage:
    powershell -ExecutionPolicy Bypass -File tools\restore_db.ps1 -ArchivePath backups\weirdtube_2026-06-28_003434.gz

  If -ArchivePath is omitted, the most recent backup in ./backups is used.

  WARNING: --drop replaces the existing collections with the backup's contents.
#>

param(
  [string]$ArchivePath
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$backupDir = Join-Path $projectRoot 'backups'

if (-not $ArchivePath) {
  $latest = Get-ChildItem $backupDir -Filter 'weirdtube_*.gz' -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $latest) { throw "No backups found in $backupDir and no -ArchivePath given." }
  $ArchivePath = $latest.FullName
  Write-Host "No archive specified; using most recent: $ArchivePath"
}

if (-not (Test-Path $ArchivePath)) { throw "Archive not found: $ArchivePath" }

Write-Host "About to restore '$ArchivePath' into the weirdtube database (existing collections will be dropped)."
$confirm = Read-Host "Type YES to continue"
if ($confirm -ne 'YES') { Write-Host "Aborted."; exit 1 }

$tmpInside = '/tmp/weirdtube_restore.gz'

Write-Host "Copying archive into container..."
docker compose cp "$ArchivePath" "mongo:$tmpInside"
if ($LASTEXITCODE -ne 0) { throw "docker compose cp failed (exit $LASTEXITCODE)" }

Write-Host "Restoring..."
docker compose exec -T mongo mongorestore --gzip --archive=$tmpInside --drop
if ($LASTEXITCODE -ne 0) { throw "mongorestore failed (exit $LASTEXITCODE)" }

docker compose exec -T mongo rm -f $tmpInside | Out-Null
Write-Host "Restore complete."
