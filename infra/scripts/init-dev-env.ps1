param(
  [string]$OutputPath = ".env"
)

$ErrorActionPreference = "Stop"
if (Test-Path -LiteralPath $OutputPath) {
  throw "$OutputPath 파일이 이미 있습니다. 기존 비밀값을 덮어쓰지 않습니다."
}

function New-Secret {
  $bytes = New-Object byte[] 48
  [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  return [Convert]::ToBase64String($bytes)
}

$template = Get-Content -LiteralPath ".env.example" -Raw
$template = $template.Replace("DATABASE_URL=", "DATABASE_URL=postgresql://campflow:campflow_dev@127.0.0.1:5433/campflow")
$template = $template.Replace("JWT_ACCESS_SECRET=", "JWT_ACCESS_SECRET=$(New-Secret)")
$template = $template.Replace("REFRESH_TOKEN_PEPPER=", "REFRESH_TOKEN_PEPPER=$(New-Secret)")
$template = $template.Replace("INVITE_TOKEN_PEPPER=", "INVITE_TOKEN_PEPPER=$(New-Secret)")
$template = $template.Replace("POSTGRES_PASSWORD=", "POSTGRES_PASSWORD=campflow_dev")
$template = $template.Replace("MINIO_ROOT_USER=", "MINIO_ROOT_USER=campflow_dev")
$template = $template.Replace("MINIO_ROOT_PASSWORD=", "MINIO_ROOT_PASSWORD=$(New-Secret)")
Set-Content -LiteralPath $OutputPath -Value $template -Encoding utf8NoBOM
Write-Host "$OutputPath 개발 환경 파일을 생성했습니다."
