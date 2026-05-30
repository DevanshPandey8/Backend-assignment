<#
Interactive demo script for recording the submission walkthrough.
Run in PowerShell from repo root: `.	ools\recording-demo.ps1`
The script pauses between steps so you can narrate and continue when ready.
#>

param(
  [string]$DbPassword = $(Read-Host 'Postgres password for user postgres (input will be hidden)' -AsSecureString | ConvertFrom-SecureString -AsPlainText 2>$null),
  [string]$PsqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe",
  [string]$GitRemote = 'https://github.com/DevanshPandey8/Backend-assignment.git'
)

function Pause($msg = 'Press Enter to run this step...') {
  Write-Host "`n--- $msg ---`n" -ForegroundColor Cyan
  Read-Host
}

# Helper to run a command and show output
function Run-Command([scriptblock]$sb) {
  try {
    & $sb
  } catch {
    Write-Host "Command failed: $_" -ForegroundColor Red
  }
}

Write-Host 'Demo script: Global Class Booking System' -ForegroundColor Green
Write-Host "Repository: $(Get-Location)`n"

# Step 1: Install dependencies
Write-Host '[Step 1] Install dependencies' -ForegroundColor Yellow
Write-Host 'Command: npm install'
Pause
npm install

# Step 2: Create DB and apply schema
Write-Host '[Step 2] Create database, apply schema and seed' -ForegroundColor Yellow
Write-Host "Using psql at: $PsqlPath"
Write-Host 'Commands:'
Write-Host "  CREATE DATABASE global_class_booking"
Write-Host "  Apply db/schema.sql and db/seed.sql"
Pause

if (-Not (Test-Path $PsqlPath)) {
  Write-Host "psql not found at $PsqlPath. Please edit the script or provide full path when prompted." -ForegroundColor Red
  $PsqlPath = Read-Host 'Enter full path to psql.exe'
}

# Export PGPASSWORD for psql commands in this process
$env:PGPASSWORD = $DbPassword
& "$PsqlPath" -U postgres -h localhost -c "CREATE DATABASE global_class_booking;" 2>&1 | Write-Host
& "$PsqlPath" -U postgres -h localhost -d global_class_booking -f db/schema.sql 2>&1 | Write-Host
& "$PsqlPath" -U postgres -h localhost -d global_class_booking -f db/seed.sql 2>&1 | Write-Host

# Step 3: Start server in a new window
Write-Host '[Step 3] Start the server in a new PowerShell window' -ForegroundColor Yellow
Write-Host 'This will open a separate window running: npm start'
Pause
$startCmd = "$env:COMSPEC /k powershell -NoExit -Command `$env:DATABASE_URL='postgres://postgres:$DbPassword@localhost:5432/global_class_booking'; npm start"
# Use Start-Process to open a new window
Start-Process powershell -ArgumentList "-NoExit","-Command`,`$env:DATABASE_URL='postgres://postgres:$DbPassword@localhost:5432/global_class_booking'; npm start"
Write-Host 'Server started in new window. Wait a few seconds for it to boot.'
Start-Sleep -Seconds 3

# Step 4: Health check
Write-Host '[Step 4] Health check' -ForegroundColor Yellow
Write-Host 'Command: Invoke-WebRequest http://localhost:3000/health -UseBasicParsing'
Pause
try { Invoke-WebRequest http://localhost:3000/health -UseBasicParsing | Select-Object -Expand Content | Write-Host } catch { Write-Host 'Health check failed' -ForegroundColor Red }

# Step 5: Create offering
Write-Host '[Step 5] Create an offering (teacher)' -ForegroundColor Yellow
Write-Host 'Command: POST /teachers/offerings'
Pause
$createBody = @{ courseName='Math'; title='Algebra 101'; teacherId='teacher-1'; teacherTimezone='America/Los_Angeles' } | ConvertTo-Json
$createResp = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/teachers/offerings' -Body $createBody -ContentType 'application/json'
$offeringId = $createResp.offering.id
Write-Host "Created offering id: $offeringId"

# Step 6: Add sessions (teacher-local times)
Write-Host '[Step 6] Add session to offering (teacher-local timezone)' -ForegroundColor Yellow
Write-Host 'Command: POST /teachers/offerings/<offeringId>/sessions'
Pause
$sessions = @{ sessions = @( @{ startAt='2026-06-10T10:00:00'; endAt='2026-06-10T11:00:00' } ) } | ConvertTo-Json -Depth 4
$addResp = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/teachers/offerings/$offeringId/sessions" -Body $sessions -ContentType 'application/json'
Write-Host 'Added sessions:'; $addResp.sessions | Format-List

# Step 7: List offerings (as parent)
Write-Host '[Step 7] List offerings (show timezone conversion)' -ForegroundColor Yellow
Write-Host 'Command: GET /offerings?timezone=America/Los_Angeles'
Pause
Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/offerings?timezone=America/Los_Angeles' | ConvertTo-Json -Depth 5 | Write-Host

# Step 8: Book the offering as a parent
Write-Host '[Step 8] Book offering as parent-1' -ForegroundColor Yellow
Write-Host 'Command: POST /parents/parent-1/bookings'
Pause
$bookBody = @{ offeringId = $offeringId } | ConvertTo-Json
try { $bookResp = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/parents/parent-1/bookings' -Body $bookBody -ContentType 'application/json'; Write-Host 'Booking succeeded:'; $bookResp | ConvertTo-Json -Depth 5 | Write-Host } catch { Write-Host 'Booking failed (conflict or error)' -ForegroundColor Red; $_.Exception.Response | Format-List -Force }

# Step 9: Show bookings for parent-1
Write-Host '[Step 9] List bookings for parent-1' -ForegroundColor Yellow
Write-Host 'Command: GET /parents/parent-1/bookings?timezone=America/Los_Angeles'
Pause
Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/parents/parent-1/bookings?timezone=America/Los_Angeles' | ConvertTo-Json -Depth 6 | Write-Host

# Step 10: Run integration tests (concurrency)
Write-Host '[Step 10] Run integration tests' -ForegroundColor Yellow
Write-Host 'Command: npm test'
Pause
$env:DATABASE_URL = "postgres://postgres:$DbPassword@localhost:5432/global_class_booking"
npm test

# Step 11: Optional: run smoke scripts
Write-Host '[Step 11] Optional: run smoke test scripts' -ForegroundColor Yellow
Write-Host 'Commands: node scripts/smoke-test.js and node scripts/book-parent2.js'
Pause
node scripts/smoke-test.js | Write-Host
node scripts/book-parent2.js | Write-Host

# Step 12: Create submission zip
Write-Host '[Step 12] Create submission ZIP' -ForegroundColor Yellow
Write-Host 'Command: Compress-Archive ...'
Pause
Compress-Archive -Path src,db,openapi.yaml,README.md,tests,scripts,postman_collection.json,SUBMISSION.md,RECORDING_SCRIPT.md,Dockerfile,docker-compose.yml,tsconfig.json,package.json -DestinationPath global-class-booking-submission.zip -Force
Write-Host 'Created global-class-booking-submission.zip'

# Step 13: Optional: push final commit to GitHub
Write-Host '[Step 13] Optional: Commit & push final changes to GitHub' -ForegroundColor Yellow
Write-Host 'Will push to: ' $GitRemote
if ((Read-Host 'Push to GitHub now? (y/n)') -eq 'y') {
  git add .
  git commit -m 'chore: final submission snapshot'
  if ($LASTEXITCODE -ne 0) { Write-Host 'No changes to commit' } else { git push $GitRemote main }
}

Write-Host '`nDemo script finished.' -ForegroundColor Green
