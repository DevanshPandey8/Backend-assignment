import { strict as assert } from 'node:assert';
import { after, before, beforeEach, test } from 'node:test';
import { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { app } from '../src/app';
import { closeDatabase, pool, query } from '../src/db';

const baseTeacherId = 'teacher-race';
const baseParentId = 'parent-race';

let server: http.Server;
let baseUrl: string;

async function requestJson(path: string, options: RequestInit = {}): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {})
    },
    ...options
  });

  return {
    status: response.status,
    body: await response.json()
  };
}

async function resetDatabase(): Promise<void> {
  await query('TRUNCATE TABLE bookings, sessions, offerings RESTART IDENTITY CASCADE');
}

async function ensureDatabaseAndSchema(): Promise<void> {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/global_class_booking');
  const databaseName = databaseUrl.pathname.replace(/^\//, '') || 'global_class_booking';
  const adminUrl = new URL(databaseUrl.toString());
  adminUrl.pathname = '/postgres';

  const adminClient = new Client({ connectionString: adminUrl.toString() });
  await adminClient.connect();

  try {
    const existsResult = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);

    if (existsResult.rowCount === 0) {
      const quotedDatabaseName = `"${databaseName.replace(/"/g, '""')}"`;
      await adminClient.query(`CREATE DATABASE ${quotedDatabaseName}`);
    }
  } finally {
    await adminClient.end();
  }

  const schemaSql = await readFile(resolve(process.cwd(), 'db', 'schema.sql'), 'utf8');
  const seedSql = await readFile(resolve(process.cwd(), 'db', 'seed.sql'), 'utf8');

  await query(schemaSql);
  await query(seedSql);
}

async function createOfferingWithSessions(): Promise<string> {
  const offeringResponse = await requestJson('/teachers/offerings', {
    method: 'POST',
    body: JSON.stringify({
      courseName: 'Race Condition Prep',
      title: 'Evening Batch',
      teacherId: baseTeacherId,
      teacherTimezone: 'America/New_York'
    })
  });

  assert.equal(offeringResponse.status, 201);
  const offeringId = (offeringResponse.body as { offering: { id: string } }).offering.id;

  const sessionsResponse = await requestJson(`/teachers/offerings/${offeringId}/sessions`, {
    method: 'POST',
    body: JSON.stringify({
      sessions: [
        { startAt: '2026-06-06T18:00:00', endAt: '2026-06-06T19:00:00' },
        { startAt: '2026-06-13T18:00:00', endAt: '2026-06-13T19:00:00' }
      ]
    })
  });

  assert.equal(sessionsResponse.status, 201);
  return offeringId;
}

before(async () => {
  await ensureDatabaseAndSchema();

  server = app.listen(0);
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  await resetDatabase();
});

after(async () => {
  server.close();
  await closeDatabase();
});

test('rejects overlapping booking races for the same parent', async () => {
  const firstOfferingId = await createOfferingWithSessions();

  const secondOfferingResponse = await requestJson('/teachers/offerings', {
    method: 'POST',
    body: JSON.stringify({
      courseName: 'Overlapping Course',
      title: 'Weekend Batch',
      teacherId: 'teacher-race-2',
      teacherTimezone: 'America/New_York'
    })
  });

  const secondOfferingId = (secondOfferingResponse.body as { offering: { id: string } }).offering.id;

  await requestJson(`/teachers/offerings/${secondOfferingId}/sessions`, {
    method: 'POST',
    body: JSON.stringify({
      sessions: [
        { startAt: '2026-06-06T18:30:00', endAt: '2026-06-06T19:30:00' },
        { startAt: '2026-06-13T18:30:00', endAt: '2026-06-13T19:30:00' }
      ]
    })
  });

  const [firstBooking, secondBooking] = await Promise.all([
    requestJson(`/parents/${baseParentId}/bookings`, {
      method: 'POST',
      body: JSON.stringify({ offeringId: firstOfferingId })
    }),
    requestJson(`/parents/${baseParentId}/bookings`, {
      method: 'POST',
      body: JSON.stringify({ offeringId: secondOfferingId })
    })
  ]);

  const statuses = [firstBooking.status, secondBooking.status].sort();
  assert.deepEqual(statuses, [201, 409]);

  const bookings = await requestJson(`/parents/${baseParentId}/bookings?timezone=America/New_York`);
  assert.equal(bookings.status, 200);

  const bookingList = bookings.body as { bookings: Array<{ offeringId: string }> };
  assert.equal(bookingList.bookings.length, 1);
  assert.equal(bookingList.bookings[0].offeringId, firstOfferingId);
});

test('prevents a later overlapping booking after the first one is committed', async () => {
  const firstOfferingId = await createOfferingWithSessions();

  const secondOfferingId = randomUUID();
  await query(
    'INSERT INTO offerings (id, course_name, title, teacher_id, teacher_timezone) VALUES ($1, $2, $3, $4, $5)',
    [secondOfferingId, 'Later Overlap', 'Alternate Batch', 'teacher-race-2', 'America/New_York']
  );

  await query(
    `
      INSERT INTO sessions (offering_id, teacher_id, start_at, end_at)
      VALUES ($1, $2, $3, $4)
    `,
    [secondOfferingId, 'teacher-race-2', '2026-06-06T22:15:00Z', '2026-06-06T23:15:00Z']
  );

  const firstBooking = await requestJson(`/parents/${baseParentId}/bookings`, {
    method: 'POST',
    body: JSON.stringify({ offeringId: firstOfferingId })
  });

  assert.equal(firstBooking.status, 201);

  const overlappingBooking = await requestJson(`/parents/${baseParentId}/bookings`, {
    method: 'POST',
    body: JSON.stringify({ offeringId: secondOfferingId })
  });

  assert.equal(overlappingBooking.status, 409);
  assert.equal((overlappingBooking.body as { error: { code: string } }).error.code, 'SCHEDULE_CONFLICT');
});