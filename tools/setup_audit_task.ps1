# Registers a monthly Windows Scheduled Task that runs the read-only video
# availability audit (scheduled_audit.ps1) on the 1st of each month at 9am,
# only while you're logged on (so no stored password is needed).
#
# Run once:  powershell -ExecutionPolicy Bypass -File tools/setup_audit_task.ps1
# Remove:    schtasks /Delete /TN "WeirdTube Video Audit" /F

$ErrorActionPreference = 'Stop'
$wrapper  = Join-Path $PSScriptRoot 'scheduled_audit.ps1'
$taskName = 'WeirdTube Video Audit'
$action   = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$wrapper`""

schtasks /Create /TN $taskName /TR $action /SC MONTHLY /D 1 /ST 09:00 /RU $env:USERNAME /IT /RL LIMITED /F

Write-Host "`nRegistered scheduled task '$taskName' (monthly, 1st at 09:00)."
Write-Host "Logs are written to logs\video_audit_<timestamp>.log"
