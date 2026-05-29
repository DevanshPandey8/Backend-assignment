"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingService = exports.BookingService = void 0;
const db_1 = require("../db");
const errors_1 = require("../errors");
const time_1 = require("../utils/time");
class BookingService {
    async bookOffering(input) {
        if (!input.parentId.trim() || !input.offeringId.trim()) {
            throw (0, errors_1.badRequest)('INVALID_BOOKING_REQUEST', 'parentId and offeringId are required');
        }
        return (0, db_1.transaction)(async (client) => {
            await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [input.parentId.trim()]);
            const offering = await client.query('SELECT id FROM offerings WHERE id = $1', [input.offeringId.trim()]);
            if (offering.rowCount === 0) {
                throw (0, errors_1.notFound)('OFFERING_NOT_FOUND', 'Offering not found');
            }
            const offeringSessions = await client.query(`
          SELECT id, offering_id AS "offeringId", teacher_id AS "teacherId", start_at AS "startAt", end_at AS "endAt"
          FROM sessions
          WHERE offering_id = $1
          ORDER BY start_at ASC
        `, [input.offeringId.trim()]);
            if (offeringSessions.rowCount === 0) {
                throw (0, errors_1.badRequest)('OFFERING_HAS_NO_SESSIONS', 'Offering does not have any sessions');
            }
            const existingBookings = await client.query(`
          SELECT b.offering_id AS booked_offering_id, s.start_at AS session_start_at, s.end_at AS session_end_at
          FROM bookings b
          JOIN sessions s ON s.offering_id = b.offering_id
          WHERE b.parent_id = $1
        `, [input.parentId.trim()]);
            const newSessions = offeringSessions.rows.map((row) => ({
                startAt: row.startAt,
                endAt: row.endAt
            }));
            for (const existingBooking of existingBookings.rows) {
                const existingSession = {
                    startAt: existingBooking.session_start_at,
                    endAt: existingBooking.session_end_at
                };
                if (newSessions.some((session) => (0, time_1.overlapExists)(session.startAt, session.endAt, existingSession.startAt, existingSession.endAt))) {
                    throw (0, errors_1.conflict)('SCHEDULE_CONFLICT', 'The parent already has a booked session that overlaps with this offering');
                }
            }
            try {
                const bookingResult = await client.query(`
            INSERT INTO bookings (offering_id, parent_id)
            VALUES ($1, $2)
            RETURNING id, offering_id, parent_id, created_at
          `, [input.offeringId.trim(), input.parentId.trim()]);
                return {
                    bookingId: bookingResult.rows[0].id,
                    offeringId: bookingResult.rows[0].offering_id,
                    parentId: bookingResult.rows[0].parent_id
                };
            }
            catch (error) {
                if (error instanceof Error && 'code' in error && error.code === '23505') {
                    throw (0, errors_1.conflict)('ALREADY_BOOKED', 'This parent has already booked this offering');
                }
                throw error;
            }
        });
    }
    async getParentBookings(parentId) {
        if (!parentId.trim()) {
            throw (0, errors_1.badRequest)('INVALID_PARENT_ID', 'parentId is required');
        }
        const bookings = await (0, db_1.query)(`
        SELECT id, offering_id, parent_id, created_at
        FROM bookings
        WHERE parent_id = $1
        ORDER BY created_at DESC
      `, [parentId.trim()]);
        const result = [];
        for (const booking of bookings) {
            const sessions = await (0, db_1.query)(`
          SELECT id, offering_id AS "offeringId", teacher_id AS "teacherId", start_at AS "startAt", end_at AS "endAt"
          FROM sessions
          WHERE offering_id = $1
          ORDER BY start_at ASC
        `, [booking.offering_id]);
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
exports.BookingService = BookingService;
exports.bookingService = new BookingService();
//# sourceMappingURL=bookingService.js.map