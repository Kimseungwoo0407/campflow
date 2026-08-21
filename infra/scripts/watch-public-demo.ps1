param(
  [ValidateRange(1, 10)]
  [int]$HealthAttempts = 3,
  [ValidateRange(2, 60)]
  [int]$HealthTimeoutSeconds = 10,
  [ValidateRange(0, 60)]
  [int]$RetryDelaySeconds = 10,
  [ValidateRange(30, 600)]
  [int]$RecoveryTimeoutSeconds = 180,
  [string]$LogPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$workflowPath = Join-Path $repositoryRoot ".github\workflows\pages.yml"
$refreshScriptPath = Join-Path $PSScriptRoot "refresh-public-demo.ps1"
$powerShellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

if ([string]::IsNullOrWhiteSpace($LogPath)) {
  $LogPath = Join-Path $repositoryRoot "storage\logs\public-demo-watchdog.log"
}
$LogPath = [IO.Path]::GetFullPath($LogPath)
$logDirectory = Split-Path -Parent $LogPath
if (-not (Test-Path -LiteralPath $logDirectory)) {
  New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
}

function Write-WatchdogLog {
  param(
    [Parameter(Mandatory = $true)][string]$Message,
    [ValidateSet("INFO", "WARN", "ERROR")][string]$Level = "INFO"
  )

  $line = "{0} [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"), $Level, $Message
  # Logging must not write to the success output stream. Test-ApiHealth is used
  # as a Boolean expression, and emitted log lines would make a failed health
  # check (log lines followed by $false) evaluate as truthy.
  Write-Host $line
  [IO.File]::AppendAllText(
    $LogPath,
    $line + [Environment]::NewLine,
    (New-Object Text.UTF8Encoding($false))
  )
}

function Get-ConfiguredApiUrl {
  $workflowText = [IO.File]::ReadAllText($workflowPath)
  $matches = [regex]::Matches(
    $workflowText,
    '(?m)^\s*VITE_API_BASE_URL:\s*(https://\S+/v1)\s*$'
  )
  if ($matches.Count -ne 1) {
    throw "Expected exactly one public API URL in $workflowPath; found $($matches.Count)."
  }
  return $matches[0].Groups[1].Value.TrimEnd("/")
}

function Test-ApiHealth {
  param(
    [Parameter(Mandatory = $true)][string]$ApiUrl,
    [Parameter(Mandatory = $true)][int]$Attempts
  )

  $healthUrl = "$($ApiUrl.TrimEnd('/'))/health/live"
  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    try {
      $response = Invoke-WebRequest `
        -UseBasicParsing `
        -Uri $healthUrl `
        -TimeoutSec $HealthTimeoutSeconds `
        -Headers @{ "User-Agent" = "CampFlow-Watchdog/1.0" }
      if ($response.StatusCode -eq 200) {
        return $true
      }
      Write-WatchdogLog `
        -Level "WARN" `
        -Message "Health attempt $attempt/$Attempts returned HTTP $($response.StatusCode): $healthUrl"
    } catch {
      Write-WatchdogLog `
        -Level "WARN" `
        -Message "Health attempt $attempt/$Attempts failed: $($_.Exception.Message)"
    }

    if ($attempt -lt $Attempts -and $RetryDelaySeconds -gt 0) {
      Start-Sleep -Seconds $RetryDelaySeconds
    }
  }
  return $false
}

function Test-DockerEngine {
  try {
    & docker info --format "{{.ServerVersion}}" *> $null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

function Wait-ForDockerEngine {
  param([Parameter(Mandatory = $true)][int]$WaitSeconds)

  $deadline = [DateTime]::UtcNow.AddSeconds($WaitSeconds)
  do {
    if (Test-DockerEngine) {
      return
    }
    Start-Sleep -Seconds 5
  } while ([DateTime]::UtcNow -lt $deadline)

  throw "Docker Engine did not become available within $WaitSeconds seconds."
}

function Ensure-DockerEngine {
  if (Test-DockerEngine) {
    return
  }

  $dockerDesktopCandidates = @(
    foreach ($programFilesPath in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
      if (-not [string]::IsNullOrWhiteSpace($programFilesPath)) {
        $candidate = Join-Path $programFilesPath "Docker\Docker\Docker Desktop.exe"
        if (Test-Path -LiteralPath $candidate) {
          $candidate
        }
      }
    }
  )

  if ($dockerDesktopCandidates.Count -eq 0) {
    throw "Docker Engine is unavailable and Docker Desktop was not found."
  }

  Write-WatchdogLog -Level "WARN" -Message "Docker Engine is unavailable; starting Docker Desktop."
  Start-Process -FilePath $dockerDesktopCandidates[0] -WindowStyle Hidden
  Wait-ForDockerEngine -WaitSeconds $RecoveryTimeoutSeconds
}

$mutex = New-Object Threading.Mutex($false, "Local\CampFlowPublicDemoWatchdog")
$lockTaken = $false
$scriptExitCode = 0

try {
  try {
    $lockTaken = $mutex.WaitOne(0, $false)
  } catch [Threading.AbandonedMutexException] {
    $lockTaken = $true
  }

  if (-not $lockTaken) {
    Write-WatchdogLog -Message "Another watchdog run is already active; skipping this run."
  } else {
    if (-not (Test-Path -LiteralPath $refreshScriptPath)) {
      throw "Recovery script not found: $refreshScriptPath"
    }

    $configuredApiUrl = Get-ConfiguredApiUrl
    if (Test-ApiHealth -ApiUrl $configuredApiUrl -Attempts $HealthAttempts) {
      Write-WatchdogLog -Message "Public API is healthy: $configuredApiUrl"
    } else {
      Write-WatchdogLog `
        -Level "WARN" `
        -Message "Public API is unavailable; starting Docker and refreshing the Quick Tunnel."
      Ensure-DockerEngine

      $refreshOutput = & $powerShellPath `
        -NoProfile `
        -NonInteractive `
        -ExecutionPolicy Bypass `
        -File $refreshScriptPath `
        -TimeoutSeconds $RecoveryTimeoutSeconds `
        -RestartTunnel 2>&1
      $refreshExitCode = $LASTEXITCODE
      foreach ($line in $refreshOutput) {
        Write-WatchdogLog -Message ("refresh: " + $line.ToString())
      }
      if ($refreshExitCode -ne 0) {
        throw "Recovery script failed with exit code $refreshExitCode."
      }

      $newApiUrl = Get-ConfiguredApiUrl
      if (-not (Test-ApiHealth -ApiUrl $newApiUrl -Attempts $HealthAttempts)) {
        throw "Recovery completed, but the new public API is not healthy: $newApiUrl"
      }
      Write-WatchdogLog `
        -Message "Recovery succeeded and the Pages deployment was triggered: $newApiUrl"
    }
  }
} catch {
  $scriptExitCode = 1
  Write-WatchdogLog -Level "ERROR" -Message $_.Exception.Message
} finally {
  if ($lockTaken) {
    $mutex.ReleaseMutex()
  }
  $mutex.Dispose()
}

exit $scriptExitCode
