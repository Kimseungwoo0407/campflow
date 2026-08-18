param(
  [ValidateRange(10, 600)]
  [int]$TimeoutSeconds = 120,
  [switch]$RestartTunnel,
  [switch]$SkipComposeUp,
  [switch]$DryRun,
  [switch]$OpenPage,
  [string]$PageUrl = "https://kimseungwoo0407.github.io/campflow/"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [switch]$CaptureOutput
  )

  if ($CaptureOutput) {
    $output = & $Command @Arguments 2>&1
  } else {
    & $Command @Arguments
    $output = $null
  }

  if ($LASTEXITCODE -ne 0) {
    $renderedArguments = $Arguments -join " "
    throw "Command failed ($LASTEXITCODE): $Command $renderedArguments"
  }

  if ($CaptureOutput) {
    return (($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine)
  }
}

function Assert-CommandExists {
  param([Parameter(Mandatory = $true)][string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command is not installed or is not on PATH: $Name"
  }
}

function Push-MainWithRetry {
  param([ValidateRange(1, 5)][int]$Attempts = 3)

  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    try {
      Invoke-NativeCommand -Command "git" -Arguments @("push", "origin", "main")
      return
    } catch {
      if ($attempt -eq $Attempts) {
        throw
      }
      Write-Warning "Git push attempt $attempt/$Attempts failed; retrying in 10 seconds."
      Start-Sleep -Seconds 10
    }
  }
}

function Get-CurrentTunnelUrl {
  param(
    [Parameter(Mandatory = $true)][string[]]$ComposeArguments,
    [Parameter(Mandatory = $true)][string]$ContainerStartedAt,
    [Parameter(Mandatory = $true)][int]$WaitSeconds
  )

  $deadline = [DateTime]::UtcNow.AddSeconds($WaitSeconds)
  $pattern = 'https://[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com'

  do {
    $logs = Invoke-NativeCommand `
      -Command "docker" `
      -Arguments ($ComposeArguments + @(
        "logs", "--no-color", "--since", $ContainerStartedAt, "--tail", "300", "quick-tunnel"
      )) `
      -CaptureOutput
    $matches = [regex]::Matches($logs, $pattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($matches.Count -gt 0) {
      return $matches[$matches.Count - 1].Value.ToLowerInvariant()
    }

    Start-Sleep -Seconds 2
  } while ([DateTime]::UtcNow -lt $deadline)

  throw "Quick Tunnel URL was not found within $WaitSeconds seconds. Check: docker compose logs quick-tunnel"
}

function Wait-ForApiHealth {
  param(
    [Parameter(Mandatory = $true)][string]$HealthUrl,
    [Parameter(Mandatory = $true)][int]$WaitSeconds
  )

  $deadline = [DateTime]::UtcNow.AddSeconds($WaitSeconds)
  do {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $HealthUrl -TimeoutSec 10
      if ($response.StatusCode -eq 200) {
        return
      }
    } catch {
      # A new Quick Tunnel can need a few seconds before its DNS record is usable.
    }

    Start-Sleep -Seconds 2
  } while ([DateTime]::UtcNow -lt $deadline)

  throw "The public API did not become healthy within $WaitSeconds seconds: $HealthUrl"
}

Assert-CommandExists -Name "docker"
Assert-CommandExists -Name "git"

if ($RestartTunnel -and $SkipComposeUp) {
  throw "RestartTunnel and SkipComposeUp cannot be used together."
}

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$envPath = Join-Path $repositoryRoot ".env"
$developmentComposePath = Join-Path $repositoryRoot "infra\docker-compose.dev.yml"
$publicDemoComposePath = Join-Path $repositoryRoot "infra\docker-compose.public-demo.yml"
$workflowRelativePath = ".github/workflows/pages.yml"
$workflowPath = Join-Path $repositoryRoot ".github\workflows\pages.yml"
$composeArguments = @(
  "compose",
  "--env-file", $envPath,
  "-f", $developmentComposePath,
  "-f", $publicDemoComposePath
)

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Missing environment file: $envPath"
}

Push-Location $repositoryRoot
try {
  if (-not $SkipComposeUp) {
    Write-Host "Starting the CampFlow API and Quick Tunnel..."
    Invoke-NativeCommand `
      -Command "docker" `
      -Arguments ($composeArguments + @("up", "-d", "api", "quick-tunnel"))

    if ($RestartTunnel) {
      Write-Host "Recreating the Quick Tunnel to request a new address..."
      Invoke-NativeCommand `
        -Command "docker" `
        -Arguments ($composeArguments + @("up", "-d", "--no-deps", "--force-recreate", "quick-tunnel"))
    }
  }

  Write-Host "Finding the current Quick Tunnel address..."
  $tunnelContainerId = (Invoke-NativeCommand `
    -Command "docker" `
    -Arguments ($composeArguments + @("ps", "-q", "quick-tunnel")) `
    -CaptureOutput).Trim()
  if ([string]::IsNullOrWhiteSpace($tunnelContainerId)) {
    throw "The Quick Tunnel container is not running."
  }

  $tunnelStartedAt = (Invoke-NativeCommand `
    -Command "docker" `
    -Arguments @("inspect", "--format={{.State.StartedAt}}", $tunnelContainerId) `
    -CaptureOutput).Trim()
  $tunnelUrl = Get-CurrentTunnelUrl `
    -ComposeArguments $composeArguments `
    -ContainerStartedAt $tunnelStartedAt `
    -WaitSeconds $TimeoutSeconds
  $apiUrl = "$tunnelUrl/v1"
  $healthUrl = "$apiUrl/health/live"

  Write-Host "Checking $healthUrl ..."
  Wait-ForApiHealth -HealthUrl $healthUrl -WaitSeconds $TimeoutSeconds
  Write-Host "Public API is healthy: $apiUrl"

  $workflowStatus = Invoke-NativeCommand `
    -Command "git" `
    -Arguments @("status", "--porcelain", "--untracked-files=no", "--", $workflowRelativePath) `
    -CaptureOutput
  if (-not [string]::IsNullOrWhiteSpace($workflowStatus)) {
    throw "$workflowRelativePath already has uncommitted changes. Commit or restore that file before running this script."
  }

  $workflowText = [IO.File]::ReadAllText($workflowPath)
  $endpointPattern = '(?m)^(\s*VITE_API_BASE_URL:\s*)\S+\s*$'
  $endpointMatches = [regex]::Matches($workflowText, $endpointPattern)
  if ($endpointMatches.Count -ne 1) {
    throw "Expected exactly one VITE_API_BASE_URL entry in $workflowRelativePath; found $($endpointMatches.Count)."
  }

  $currentApiUrl = $endpointMatches[0].Groups[0].Value.Split(":", 2)[1].Trim()
  if ($currentApiUrl -eq $apiUrl) {
    Write-Host "GitHub Pages already targets the current tunnel. No deployment is needed."
    if ($OpenPage) {
      Start-Process $PageUrl
    }
    exit 0
  }

  Write-Host "GitHub Pages API: $currentApiUrl"
  Write-Host "New API:          $apiUrl"

  if ($DryRun) {
    Write-Host "Dry run complete. No files, commits, or remote branches were changed."
    exit 0
  }

  $branch = (Invoke-NativeCommand -Command "git" -Arguments @("branch", "--show-current") -CaptureOutput).Trim()
  if ($branch -ne "main") {
    throw "The automatic deployment must run from the main branch. Current branch: $branch"
  }

  Write-Host "Checking that local main matches origin/main..."
  Invoke-NativeCommand -Command "git" -Arguments @("fetch", "origin", "main")
  $localHead = (Invoke-NativeCommand -Command "git" -Arguments @("rev-parse", "HEAD") -CaptureOutput).Trim()
  $remoteHead = (Invoke-NativeCommand -Command "git" -Arguments @("rev-parse", "refs/remotes/origin/main") -CaptureOutput).Trim()
  if ($localHead -ne $remoteHead) {
    throw "Local main and origin/main are not synchronized. Pull or push the existing commits before retrying."
  }

  $updatedWorkflowText = [regex]::Replace(
    $workflowText,
    $endpointPattern,
    [Text.RegularExpressions.MatchEvaluator]{
      param($match)
      return $match.Groups[1].Value + $apiUrl
    }
  )
  $utf8WithoutBom = New-Object Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($workflowPath, $updatedWorkflowText, $utf8WithoutBom)

  $commitCreated = $false
  try {
    Invoke-NativeCommand -Command "git" -Arguments @("diff", "--check", "--", $workflowRelativePath)
    Invoke-NativeCommand `
      -Command "git" `
      -Arguments @(
        "commit", "--only", "-m", "chore: refresh public demo tunnel", "--", $workflowRelativePath
      )
    $commitCreated = $true
    Push-MainWithRetry
  } catch {
    if (-not $commitCreated) {
      [IO.File]::WriteAllText($workflowPath, $workflowText, $utf8WithoutBom)
    }
    throw
  }

  Write-Host "GitHub Pages deployment was triggered by the push."
  Write-Host "Page: $PageUrl"
  if ($OpenPage) {
    Start-Process $PageUrl
  }
} finally {
  Pop-Location
}
