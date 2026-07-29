param(
  [string]$OutputPath = ".env",
  [string]$PostgresPassword = "campflow_dev",
  [string]$AppOrigin = "http://localhost:5173",
  [ValidateSet("development", "test", "production")]
  [string]$NodeEnvironment = "development",
  [ValidateSet("false", "true")]
  [string]$CookieSecure = "false",
  [ValidateSet("lax", "strict", "none")]
  [string]$CookieSameSite = "lax",
  [string]$FriendAccountsJson = "",
  [ValidateSet("false", "true")]
  [string]$AllowProductionSeed = "false"
)

$ErrorActionPreference = "Stop"
if (Test-Path -LiteralPath $OutputPath) {
  throw "$OutputPath 파일이 이미 있습니다. 기존 비밀값을 덮어쓰지 않습니다."
}

function New-Secret {
  $bytes = New-Object byte[] 48
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
  } finally {
    $generator.Dispose()
  }
  return [Convert]::ToBase64String($bytes)
}

$template = Get-Content -LiteralPath ".env.example" -Raw
$template = $template.Replace("NODE_ENV=development", "NODE_ENV=$NodeEnvironment")
$template = $template.Replace("APP_ORIGIN=http://localhost:5173", "APP_ORIGIN=$AppOrigin")
$template = $template.Replace("DATABASE_URL=", "DATABASE_URL=postgresql://campflow:$PostgresPassword@127.0.0.1:5433/campflow")
$template = $template.Replace("JWT_ACCESS_SECRET=", "JWT_ACCESS_SECRET=$(New-Secret)")
$template = $template.Replace("REFRESH_TOKEN_PEPPER=", "REFRESH_TOKEN_PEPPER=$(New-Secret)")
$template = $template.Replace("INVITE_TOKEN_PEPPER=", "INVITE_TOKEN_PEPPER=$(New-Secret)")
$template = $template.Replace("COOKIE_SECURE=false", "COOKIE_SECURE=$CookieSecure")
$template = $template.Replace("COOKIE_SAME_SITE=lax", "COOKIE_SAME_SITE=$CookieSameSite")
$template = $template.Replace("SEED_FRIEND_ACCOUNTS_JSON=", "SEED_FRIEND_ACCOUNTS_JSON=$FriendAccountsJson")
$template = $template.Replace("ALLOW_PRODUCTION_SEED=false", "ALLOW_PRODUCTION_SEED=$AllowProductionSeed")
$template = $template.Replace("POSTGRES_PASSWORD=", "POSTGRES_PASSWORD=$PostgresPassword")
$template = $template.Replace("MINIO_ROOT_USER=", "MINIO_ROOT_USER=campflow_dev")
$template = $template.Replace("MINIO_ROOT_PASSWORD=", "MINIO_ROOT_PASSWORD=$(New-Secret)")
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
$absoluteOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
[System.IO.File]::WriteAllText($absoluteOutputPath, $template, $utf8WithoutBom)
Write-Host "$OutputPath 개발 환경 파일을 생성했습니다."
