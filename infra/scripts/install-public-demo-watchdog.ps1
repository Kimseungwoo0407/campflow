param(
  [ValidateRange(1, 60)]
  [int]$IntervalMinutes = 5,
  [switch]$RunNow,
  [switch]$Uninstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$taskName = "CampFlow Public Demo Watchdog"
$watchdogPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "watch-public-demo.ps1"))
$powerShellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

if ($Uninstall) {
  & schtasks.exe /Delete /TN $taskName /F
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to remove scheduled task: $taskName"
  }
  Write-Host "Removed scheduled task: $taskName"
  exit 0
}

if (-not (Test-Path -LiteralPath $watchdogPath)) {
  throw "Watchdog script not found: $watchdogPath"
}

$taskCommand = (
  '"{0}" -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{1}"' -f `
    $powerShellPath,
    $watchdogPath
)

& schtasks.exe `
  /Create `
  /TN $taskName `
  /TR $taskCommand `
  /SC MINUTE `
  /MO $IntervalMinutes `
  /RL LIMITED `
  /IT `
  /F
if ($LASTEXITCODE -ne 0) {
  throw "Failed to register scheduled task: $taskName"
}

$registeredTask = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
$registeredTask.Settings.DisallowStartIfOnBatteries = $false
$registeredTask.Settings.StopIfGoingOnBatteries = $false
$registeredTask.Settings.StartWhenAvailable = $true
$registeredTask.Settings.MultipleInstances = "IgnoreNew"
Set-ScheduledTask -InputObject $registeredTask | Out-Null

Write-Host "Registered scheduled task: $taskName"
Write-Host "Interval: every $IntervalMinutes minute(s), while this Windows user is logged in."
Write-Host "Runs on battery and starts after a missed sleep-time check."
Write-Host "Watchdog: $watchdogPath"

if ($RunNow) {
  & schtasks.exe /Run /TN $taskName
  if ($LASTEXITCODE -ne 0) {
    throw "The task was registered, but its first run could not be started."
  }
  Write-Host "Started the first watchdog run."
}
