# Restores a clean demo state: drops the database and uploaded files, then
# starts the stack again so migrations and seed data run from scratch.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
docker compose down -v
docker compose up -d --build
Write-Host "Demo state restored."
