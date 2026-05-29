Recording narration script (approx. 5 minutes)

1. Intro (15s)
   - "Hi — this is a demo of the Global Class Booking System. I'll show setup, key flows, timezone handling, and booking conflict handling."

2. Setup (45s)
   - Show repo root and `README.md`.
   - Run `npm install` (or show it completed).
   - Show `db/schema.sql` and `db/seed.sql`.

3. Start DB and server (45s)
   - Show applying schema/seed to Postgres.
   - Start server with `DATABASE_URL` set.
   - Hit `/health` to confirm OK.

4. Core flows (2:00)
   - Create an offering: `POST /teachers/offerings`.
   - Add sessions in teacher's timezone: `POST /teachers/:offeringId/sessions`.
   - List offerings as a parent: `GET /offerings?timezone=America/Los_Angeles`.
   - Book offering: `POST /parents/:parentId/bookings` — show success.
   - Attempt overlapping booking from another parent/seed to show conflict.
   - Show `GET /parents/:parentId/bookings` with both UTC and formatted timezone fields.

5. Concurrency & tests (45s)
   - Run `npm test` to show integration tests passing (booking race tests).
   - Explain advisory-lock approach briefly.

6. Closing (30s)
   - Mention README, OpenAPI (`openapi.yaml`), and Postman collection included.
   - Provide GitHub repo link and thank the reviewer.

Notes:
- Keep the voice steady and brief. Focus on demonstrating the system working end-to-end.
- If recording hits a transient error, stop and re-run that step, and mention it in the video.
