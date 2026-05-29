"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.offeringService = exports.OfferingService = void 0;
const errors_1 = require("../errors");
const db_1 = require("../db");
const time_1 = require("../utils/time");
class OfferingService {
    async createOffering(input) {
        const teacherTimezone = (0, time_1.assertTimezone)(input.teacherTimezone);
        if (!input.courseName.trim() || !input.title.trim() || !input.teacherId.trim()) {
            throw (0, errors_1.badRequest)('INVALID_OFFERING', 'courseName, title, and teacherId are required');
        }
        const rows = await (0, db_1.query)(`
        INSERT INTO offerings (course_name, title, teacher_id, teacher_timezone)
        VALUES ($1, $2, $3, $4)
        RETURNING id, course_name, title, teacher_id, teacher_timezone, created_at
      `, [input.courseName.trim(), input.title.trim(), input.teacherId.trim(), teacherTimezone]);
        return this.mapOffering(rows[0]);
    }
    async addSessions(offeringId, sessions) {
        if (sessions.length === 0) {
            throw (0, errors_1.badRequest)('INVALID_SESSION_PAYLOAD', 'At least one session is required');
        }
        return (0, db_1.transaction)(async (client) => {
            const offering = await this.getOfferingById(client, offeringId);
            const createdSessions = [];
            for (const session of sessions) {
                const startAt = (0, time_1.parseLocalDateTime)(session.startAt, offering.teacherTimezone);
                const endAt = (0, time_1.parseLocalDateTime)(session.endAt, offering.teacherTimezone);
                if (endAt <= startAt) {
                    throw (0, errors_1.badRequest)('INVALID_SESSION_WINDOW', 'Session endAt must be after startAt');
                }
                const rows = await client.query(`
            INSERT INTO sessions (offering_id, teacher_id, start_at, end_at)
            VALUES ($1, $2, $3, $4)
            RETURNING id, offering_id, teacher_id, start_at, end_at
          `, [offeringId, offering.teacherId, startAt, endAt]);
                createdSessions.push(this.mapSession(rows.rows[0]));
            }
            return createdSessions;
        });
    }
    async getTeacherOfferings(teacherId, timezone) {
        const validTeacherId = teacherId.trim();
        if (!validTeacherId) {
            throw (0, errors_1.badRequest)('INVALID_TEACHER_ID', 'teacherId is required');
        }
        const rows = await (0, db_1.query)(`
        SELECT id, course_name, title, teacher_id, teacher_timezone, created_at
        FROM offerings
        WHERE teacher_id = $1
        ORDER BY created_at DESC
      `, [validTeacherId]);
        const offerings = rows.map((row) => this.mapOffering(row));
        const sessions = await this.fetchSessionsForOfferings(offerings.map((offering) => offering.id));
        const targetTimezone = timezone ? (0, time_1.assertTimezone)(timezone) : undefined;
        return offerings.map((offering) => this.serializeOffering(offering, sessions.get(offering.id) ?? [], targetTimezone ?? offering.teacherTimezone));
    }
    async listAvailableOfferings(timezone, parentId) {
        const targetTimezone = (0, time_1.assertTimezone)(timezone);
        const offerings = await (0, db_1.query)(`
        SELECT DISTINCT o.id, o.course_name, o.title, o.teacher_id, o.teacher_timezone, o.created_at
        FROM offerings o
        JOIN sessions s ON s.offering_id = o.id
        WHERE s.end_at > NOW()
        ORDER BY o.created_at DESC
      `);
        const mappedOfferings = offerings.map((row) => this.mapOffering(row));
        const sessions = await this.fetchSessionsForOfferings(mappedOfferings.map((offering) => offering.id));
        const bookedOfferingIds = parentId
            ? new Set((await (0, db_1.query)('SELECT offering_id FROM bookings WHERE parent_id = $1', [parentId.trim()])).map((row) => row.offering_id))
            : new Set();
        return mappedOfferings.map((offering) => ({
            ...this.serializeOffering(offering, sessions.get(offering.id) ?? [], targetTimezone),
            bookedByParent: bookedOfferingIds.has(offering.id)
        }));
    }
    async getOfferingSessions(offeringId) {
        const sessions = await (0, db_1.query)(`
        SELECT id, offering_id, teacher_id, start_at, end_at
        FROM sessions
        WHERE offering_id = $1
        ORDER BY start_at ASC
      `, [offeringId]);
        return sessions.map((session) => this.mapSession(session));
    }
    async getOfferingById(client, offeringId) {
        const rows = await client.query(`
        SELECT id, course_name, title, teacher_id, teacher_timezone, created_at
        FROM offerings
        WHERE id = $1
      `, [offeringId]);
        if (rows.rowCount === 0) {
            throw (0, errors_1.notFound)('OFFERING_NOT_FOUND', 'Offering not found');
        }
        return this.mapOffering(rows.rows[0]);
    }
    async fetchSessionsForOfferings(offeringIds) {
        if (offeringIds.length === 0) {
            return new Map();
        }
        const rows = await (0, db_1.query)(`
        SELECT id, offering_id, teacher_id, start_at, end_at
        FROM sessions
        WHERE offering_id = ANY($1::uuid[])
        ORDER BY start_at ASC
      `, [offeringIds]);
        return rows.reduce((accumulator, row) => {
            const session = this.mapSession(row);
            const current = accumulator.get(session.offeringId) ?? [];
            current.push(session);
            accumulator.set(session.offeringId, current);
            return accumulator;
        }, new Map());
    }
    mapOffering(row) {
        return {
            id: row.id,
            courseName: row.course_name,
            title: row.title,
            teacherId: row.teacher_id,
            teacherTimezone: row.teacher_timezone,
            createdAt: row.created_at
        };
    }
    mapSession(row) {
        return {
            id: row.id,
            offeringId: row.offering_id,
            teacherId: row.teacher_id,
            startAt: row.start_at,
            endAt: row.end_at
        };
    }
    serializeOffering(offering, sessions, timezone) {
        return {
            ...offering,
            sessions: sessions.map((session) => ({
                id: session.id,
                offeringId: session.offeringId,
                teacherId: session.teacherId,
                startAtUtc: session.startAt.toISOString(),
                endAtUtc: session.endAt.toISOString(),
                startAt: (0, time_1.formatDateTimeInZone)(session.startAt, timezone),
                endAt: (0, time_1.formatDateTimeInZone)(session.endAt, timezone)
            }))
        };
    }
}
exports.OfferingService = OfferingService;
exports.offeringService = new OfferingService();
//# sourceMappingURL=offeringService.js.map