<#
Starts services via Docker Compose, waits for Postgres and the app, then runs integration tests.

Usage (PowerShell):
  .\scripts\start-with-docker.ps1

#>
Set-StrictMode -Version Latest

function Abort([string]$msg) {
  Write-Error $msg
  exit 1
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Abort 'Docker is not installed or not found on PATH. Install Docker Desktop or Docker Engine and try again.'
}

Write-Host 'Bringing up containers with docker compose...'
docker compose up --build -d

$maxWait = 120
$elapsed = 0
Write-Host 'Waiting for Postgres (port 5432) to accept connections...'
while (-not (Test-NetConnection -ComputerName 'localhost' -Port 5432 -InformationLevel Quiet)) {
  Start-Sleep -Seconds 1
  $elapsed += 1
  if ($elapsed -gt $maxWait) { Abort 'Timed out waiting for Postgres to become available.' }
}

Write-Host 'Postgres is accepting connections.'

Write-Host 'Waiting for app health endpoint http://localhost:3000/health ...'
$elapsed = 0
while ($true) {
  try {
    $resp = Invoke-WebRequest -Uri 'http://localhost:3000/health' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    if ($resp.StatusCode -eq 200) { break }
  } catch {
    # still starting
  }

  Start-Sleep -Seconds 1
  $elapsed += 1
  if ($elapsed -gt $maxWait) { Abort 'Timed out waiting for the app health endpoint.' }
}

Write-Host 'App is healthy.'

Write-Host 'Running integration tests (this will install dependencies if needed)...'
$env:DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/global_class_booking'
npm install
npm test

Write-Host 'Done.'