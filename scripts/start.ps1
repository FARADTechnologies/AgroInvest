# Starts the whole portal. On the first run it creates .env from .env.example
# and replaces every secret with a random value.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path ".env")) {
    $lines = Get-Content ".env.example" -Encoding UTF8
    foreach ($key in "POSTGRES_PASSWORD", "JWT_SECRET", "EKTIS_API_KEY", "EKTIS_HMAC_SECRET") {
        $bytes = New-Object byte[] 32
        [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        $value = -join ($bytes | ForEach-Object { $_.ToString("x2") })
        $lines = $lines -replace "^$key=.*", "$key=$value"
    }
    [System.IO.File]::WriteAllLines((Join-Path (Get-Location) ".env"), $lines, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "Created .env with random secrets."
}

docker compose up -d --build
Write-Host "Portal:     http://localhost:3000"
Write-Host "API docs:   http://localhost:8000/api/v1/docs"
Write-Host "EKTIS mock: http://localhost:8081/swagger-ui.html"
