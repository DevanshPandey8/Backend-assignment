import { PoolClient } from 'pg';
import { badRequest, notFound } from '../errors';
import { query, transaction } from '../db';
import { assertTimezone, formatDateTimeInZone, parseLocalDateTime } from '../utils/time';
import { OfferingRecord, SessionRecord } from '../types';

type CreateOfferingInput = {
  courseName: string;
  title: string;
  teacherId: string;
  teacherTimezone: string;
};

type CreateSessionInput = {
  startAt: string;
  endAt: string;
};

type SerializedSession = {
  id: string;
  offeringId: string;
  teacherId: string;
  startAtUtc: string;
  endAtUtc: string;
  startAt: string;
  endAt: string;
};

type SerializedOffering = OfferingRecord & {
  sessions: SerializedSession[];
};

type AvailableOffering = SerializedOffering & {
  bookedByParent: boolean;
};

type OfferingRow = {
  id: string;
  course_name: string;
  title: string;
  teacher_id: string;
  teacher_timezone: string;
  created_at: Date;
};

type SessionRow = {
  id: string;
  offering_id: string;
  teacher_id: string;
  start_at: Date;
  end_at: Date;
};

export class OfferingService {
  async createOffering(input: CreateOfferingInput): Promise<OfferingRecord> {
    const teacherTimezone = assertTimezone(input.teacherTimezone);

    if (!input.courseName.trim() || !input.title.trim() || !input.teacherId.trim()) {
      throw badRequest('INVALID_OFFERING', 'courseName, title, and teacherId are required');
    }

    const rows = await query<OfferingRow>(
      `
        INSERT INTO offerings (course_name, title, teacher_id, teacher_timezone)
        VALUES ($1, $2, $3, $4)
        RETURNING id, course_name, title, teacher_id, teacher_timezone, created_at
      `,
      [input.courseName.trim(), input.title.trim(), input.teacherId.trim(), teacherTimezone]
    );

    return this.mapOffering(rows[0]);
  }

  async addSessions(offeringId: string, sessions: CreateSessionInput[]): Promise<SessionRecord[]> {
    if (sessions.length === 0) {
      throw badRequest('INVALID_SESSION_PAYLOAD', 'At least one session is required');
    }

    return transaction(async (client) => {
      const offering = await this.getOfferingById(client, offeringId);

      const createdSessions: SessionRecord[] = [];

      for (const session of sessions) {
        const startAt = parseLocalDateTime(session.startAt, offering.teacherTimezone);
        const endAt = parseLocalDateTime(session.endAt, offering.teacherTimezone);

        if (endAt <= startAt) {
          throw badRequest('INVALID_SESSION_WINDOW', 'Session endAt must be after startAt');
        }

        const rows = await client.query<SessionRow>(
          `
            INSERT INTO sessions (offering_id, teacher_id, start_at, end_at)
            VALUES ($1, $2, $3, $4)
            RETURNING id, offering_id, teacher_id, start_at, end_at
          `,
          [offeringId, offering.teacherId, startAt, endAt]
        );

        createdSessions.push(this.mapSession(rows.rows[0]));
      }

      return createdSessions;
    });
  }

  async getTeacherOfferings(teacherId: string, timezone?: string): Promise<SerializedOffering[]> {
    const validTeacherId = teacherId.trim();

    if (!validTeacherId) {
      throw badRequest('INVALID_TEACHER_ID', 'teacherId is required');
    }

    const rows = await query<OfferingRow>(
      `
        SELECT id, course_name, title, teacher_id, teacher_timezone, created_at
        FROM offerings
        WHERE teacher_id = $1
        ORDER BY created_at DESC
      `,
      [validTeacherId]
    );

    const offerings = rows.map((row) => this.mapOffering(row));
    const sessions = await this.fetchSessionsForOfferings(offerings.map((offering) => offering.id));
    const targetTimezone = timezone ? assertTimezone(timezone) : undefined;

    return offerings.map((offering) => this.serializeOffering(offering, sessions.get(offering.id) ?? [], targetTimezone ?? offering.teacherTimezone));
  }

  async listAvailableOfferings(timezone: string, parentId?: string): Promise<AvailableOffering[]> {
    const targetTimezone = assertTimezone(timezone);

    const offerings = await query<OfferingRow>(
      `
        SELECT DISTINCT o.id, o.course_name, o.title, o.teacher_id, o.teacher_timezone, o.created_at
        FROM offerings o
        JOIN sessions s ON s.offering_id = o.id
        WHERE s.end_at > NOW()
        ORDER BY o.created_at DESC
      `
    );

    const mappedOfferings = offerings.map((row) => this.mapOffering(row));
    const sessions = await this.fetchSessionsForOfferings(mappedOfferings.map((offering) => offering.id));

    const bookedOfferingIds = parentId
      ? new Set(
          (
            await query<{ offering_id: string }>(
              'SELECT offering_id FROM bookings WHERE parent_id = $1',
              [parentId.trim()]
            )
          ).map((row) => row.offering_id)
        )
      : new Set<string>();

    return mappedOfferings.map((offering) => ({
      ...this.serializeOffering(offering, sessions.get(offering.id) ?? [], targetTimezone),
      bookedByParent: bookedOfferingIds.has(offering.id)
    }));
  }

  async getOfferingSessions(offeringId: string): Promise<SessionRecord[]> {
    const sessions = await query<SessionRow>(
      `
        SELECT id, offering_id, teacher_id, start_at, end_at
        FROM sessions
        WHERE offering_id = $1
        ORDER BY start_at ASC
      `,
      [offeringId]
    );

    return sessions.map((session) => this.mapSession(session));
  }

  private async getOfferingById(client: PoolClient, offeringId: string): Promise<OfferingRecord> {
    const rows = await client.query<OfferingRow>(
      `
        SELECT id, course_name, title, teacher_id, teacher_timezone, created_at
        FROM offerings
        WHERE id = $1
      `,
      [offeringId]
    );

    if (rows.rowCount === 0) {
      throw notFound('OFFERING_NOT_FOUND', 'Offering not found');
    }

    return this.mapOffering(rows.rows[0]);
  }

  private async fetchSessionsForOfferings(offeringIds: string[]): Promise<Map<string, SessionRecord[]>> {
    if (offeringIds.length === 0) {
      return new Map();
    }

    const rows = await query<SessionRow>(
      `
        SELECT id, offering_id, teacher_id, start_at, end_at
        FROM sessions
        WHERE offering_id = ANY($1::uuid[])
        ORDER BY start_at ASC
      `,
      [offeringIds]
    );

    return rows.reduce((accumulator, row) => {
      const session = this.mapSession(row);
      const current = accumulator.get(session.offeringId) ?? [];
      current.push(session);
      accumulator.set(session.offeringId, current);
      return accumulator;
    }, new Map<string, SessionRecord[]>());
  }

  private mapOffering(row: OfferingRow): OfferingRecord {
    return {
      id: row.id,
      courseName: row.course_name,
      title: row.title,
      teacherId: row.teacher_id,
      teacherTimezone: row.teacher_timezone,
      createdAt: row.created_at
    };
  }

  private mapSession(row: SessionRow): SessionRecord {
    return {
      id: row.id,
      offeringId: row.offering_id,
      teacherId: row.teacher_id,
      startAt: row.start_at,
      endAt: row.end_at
    };
  }

  private serializeOffering(offering: OfferingRecord, sessions: SessionRecord[], timezone: string): SerializedOffering {
    return {
      ...offering,
      sessions: sessions.map((session) => ({
        id: session.id,
        offeringId: session.offeringId,
        teacherId: session.teacherId,
        startAtUtc: session.startAt.toISOString(),
        endAtUtc: session.endAt.toISOString(),
        startAt: formatDateTimeInZone(session.startAt, timezone),
        endAt: formatDateTimeInZone(session.endAt, timezone)
      }))
    };
  }
}

export const offeringService = new OfferingService();