# Submission & Recording Instructions

This file explains what to include in the screen recording and how to prepare the repository for submission.

## What to record (recommended 5–10 minutes)

1. Project setup
   - Show repo root and `README.md`.
   - Run `npm install` and show the `db/schema.sql`.
2. Start Postgres (or confirm local Postgres running) and apply schema/seed (show the commands used).
3. Start the server and show `/health` returning `{ status: 'ok' }`.
4. Demonstrate core flows:
   - Create an offering (`POST /teachers/offerings`).
   - Add sessions to the offering (`POST /teachers/offerings/:offeringId/sessions`).
   - List offerings as a parent (`GET /offerings`).
   - Book an offering as a parent (`POST /parents/:parentId/bookings`).
   - Show conflict detection by attempting an overlapping booking.
   - Show timezone conversion in responses by passing `timezone` or `x-user-timezone`.
5. Show concurrency handling (optional): run the provided integration test `tests/booking-race.test.ts` or describe the outcome and show test results.
6. Mention any optional enhancements in the repo (Docker, CI).

## Recommended commands to run in the recording

```powershell
# apply schema and seed (adjust path)
$env:PGPASSWORD='your_db_password'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -h localhost -d global_class_booking -f db/schema.sql
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -h localhost -d global_class_booking -f db/seed.sql

# start server
$env:DATABASE_URL='postgres://postgres:your_db_password@localhost:5432/global_class_booking'
npm start

# run integration tests
$env:DATABASE_URL='postgres://postgres:your_db_password@localhost:5432/global_class_booking'
npm test
```

## Submitting
1. Push or upload the repository to GitHub and ensure it is accessible.
2. Fill the Google Form and include:
   - GitHub repo URL (public) or invite `hr@undoschool.com` for a private repo.
   - Video link (Loom/YouTube unlisted/Google Drive).

If you'd like, I can:
- Prepare a zipped release of the repository.
- Draft the short narration script for your recording.
- Help push the repo to GitHub (you must provide credentials or create a repo and invite me as collaborator).