<#
  Backs up the weirdtube MongoDB to a timestamped gzip archive in ./backups.

  Usage (from anywhere):
    powershell -ExecutionPolicy Bypass -File C:\path\to\tools\backup_db.ps1

  Keeps the most recent $KeepCount backups and prunes older ones.
  Restore with tools\restore_db.ps1.
#>

param(
  [int]$KeepCount = 30
)

$ErrorActionPreference = 'Stop'

# Project root = parent of this script's folder (where docker-compose.yml lives)
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$backupDir = Join-Path $projectRoot 'backups'
if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }

$timestamp  = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$outFile    = Join-Path $backupDir "weirdtube_$timestamp.gz"
$tmpInside  = '/tmp/weirdtube_backup.gz'

Write-Host "Dumping weirdtube database..."
docker compose exec -T mongo mongodump --db weirdtube --gzip --archive=$tmpInside
if ($LASTEXITCODE -ne 0) { throw "mongodump failed (exit $LASTEXITCODE)" }

Write-Host "Copying archive to $outFile"
docker compose cp "mongo:$tmpInside" "$outFile"
if ($LASTEXITCODE -ne 0) { throw "docker compose cp failed (exit $LASTEXITCODE)" }

# Clean up the temp file inside the container
docker compose exec -T mongo rm -f $tmpInside | Out-Null

if (-not (Test-Path $outFile) -or (Get-Item $outFile).Length -eq 0) {
  throw "Backup file missing or empty: $outFile"
}

$sizeKb = [math]::Round((Get-Item $outFile).Length / 1KB, 1)
Write-Host "Backup complete: $outFile ($sizeKb KB)"

# Prune old backups, keeping the newest $KeepCount
$old = Get-ChildItem $backupDir -Filter 'weirdtube_*.gz' |
       Sort-Object LastWriteTime -Descending |
       Select-Object -Skip $KeepCount
if ($old) {
  $old | Remove-Item -Force
  Write-Host "Pruned $($old.Count) old backup(s); keeping newest $KeepCount."
}
