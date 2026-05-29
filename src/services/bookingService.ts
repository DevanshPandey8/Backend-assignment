import { query, transaction } from '../db';
import { badRequest, conflict, notFound } from '../errors';
import { overlapExists } from '../utils/time';
import { SessionRecord } from '../types';

type BookOfferingInput = {
  parentId: string;
  offeringId: string;
};

type BookingRow = {
  id: string;
  offering_id: string;
  parent_id: string;
  created_at: Date;
};

export class BookingService {
  async bookOffering(input: BookOfferingInput): Promise<{ bookingId: string; offeringId: string; parentId: string }> {
    if (!input.parentId.trim() || !input.offeringId.trim()) {
      throw badRequest('INVALID_BOOKING_REQUEST', 'parentId and offeringId are required');
    }

    return transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [input.parentId.trim()]);

      const offering = await client.query<{ id: string }>('SELECT id FROM offerings WHERE id = $1', [input.offeringId.trim()]);

      if (offering.rowCount === 0) {
        throw notFound('OFFERING_NOT_FOUND', 'Offering not found');
      }

      const offeringSessions = await client.query<SessionRecord>(
        `
          SELECT id, offering_id AS "offeringId", teacher_id AS "teacherId", start_at AS "startAt", end_at AS "endAt"
          FROM sessions
          WHERE offering_id = $1
          ORDER BY start_at ASC
        `,
        [input.offeringId.trim()]
      );

      if (offeringSessions.rowCount === 0) {
        throw badRequest('OFFERING_HAS_NO_SESSIONS', 'Offering does not have any sessions');
      }

      const existingBookings = await client.query<{ booked_offering_id: string; session_start_at: Date; session_end_at: Date }>(
        `
          SELECT b.offering_id AS booked_offering_id, s.start_at AS session_start_at, s.end_at AS session_end_at
          FROM bookings b
          JOIN sessions s ON s.offering_id = b.offering_id
          WHERE b.parent_id = $1
        `,
        [input.parentId.trim()]
      );

      const newSessions = offeringSessions.rows.map((row) => ({
        startAt: row.startAt,
        endAt: row.endAt
      }));

      for (const existingBooking of existingBookings.rows) {
        const existingSession = {
          startAt: existingBooking.session_start_at,
          endAt: existingBooking.session_end_at
        };

        if (newSessions.some((session) => overlapExists(session.startAt, session.endAt, existingSession.startAt, existingSession.endAt))) {
          throw conflict('SCHEDULE_CONFLICT', 'The parent already has a booked session that overlaps with this offering');
        }
      }

      try {
        const bookingResult = await client.query<BookingRow>(
          `
            INSERT INTO bookings (offering_id, parent_id)
            VALUES ($1, $2)
            RETURNING id, offering_id, parent_id, created_at
          `,
          [input.offeringId.trim(), input.parentId.trim()]
        );

        return {
          bookingId: bookingResult.rows[0].id,
          offeringId: bookingResult.rows[0].offering_id,
          parentId: bookingResult.rows[0].parent_id
        };
      } catch (error) {
        if (error instanceof Error && 'code' in error && (error as { code?: string }).code === '23505') {
          throw conflict('ALREADY_BOOKED', 'This parent has already booked this offering');
        }

        throw error;
      }
    });
  }

  async getParentBookings(parentId: string): Promise<Array<{ bookingId: string; offeringId: string; parentId: string; sessions: SessionRecord[] }>> {
    if (!parentId.trim()) {
      throw badRequest('INVALID_PARENT_ID', 'parentId is required');
    }

    const bookings = await query<BookingRow>(
      `
        SELECT id, offering_id, parent_id, created_at
        FROM bookings
        WHERE parent_id = $1
        ORDER BY created_at DESC
      `,
      [parentId.trim()]
    );

    const result: Array<{ bookingId: string; offeringId: string; parentId: string; sessions: SessionRecord[] }> = [];

    for (const booking of bookings) {
      const sessions = await query<SessionRecord>(
        `
          SELECT id, offering_id AS "offeringId", teacher_id AS "teacherId", start_at AS "startAt", end_at AS "endAt"
          FROM sessions
          WHERE offering_id = $1
          ORDER BY start_at ASC
        `,
        [booking.offering_id]
      );

      result.push({
        bookingId: booking.id,
        offeringId: booking.offering_id,
        parentId: booking.parent_id,
        sessions: sessions.map((session) => ({
          id: session.id,
          offeringId: session.offeringId,
          teacherId: session.teacherId,
          startAt: session.startAt,
          endAt: session.endAt
        }))
      });
    }

    return result;
  }
}

export const bookingService = new BookingService();