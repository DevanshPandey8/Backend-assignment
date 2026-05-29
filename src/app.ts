import express, { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from './errors';
import { bookingService } from './services/bookingService';
import { offeringService } from './services/offeringService';
import { assertTimezone, formatDateTimeInZone } from './utils/time';

const createOfferingSchema = z.object({
  courseName: z.string().min(1),
  title: z.string().min(1),
  teacherId: z.string().min(1),
  teacherTimezone: z.string().min(1)
});

const createSessionsSchema = z.object({
  sessions: z.array(
    z.object({
      startAt: z.string().min(1),
      endAt: z.string().min(1)
    })
  ).min(1)
});

const bookOfferingSchema = z.object({
  parentId: z.string().min(1),
  offeringId: z.string().uuid()
});

const app = express();

app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.post('/teachers/offerings', async (request, response, next) => {
  try {
    const payload = createOfferingSchema.parse(request.body);
    const offering = await offeringService.createOffering(payload);
    response.status(201).json({ offering });
  } catch (error) {
    next(error);
  }
});

app.post('/teachers/offerings/:offeringId/sessions', async (request, response, next) => {
  try {
    const offeringId = request.params.offeringId;
    const payload = createSessionsSchema.parse(request.body);
    const sessions = await offeringService.addSessions(offeringId, payload.sessions);
    response.status(201).json({ sessions });
  } catch (error) {
    next(error);
  }
});

app.get('/teachers/:teacherId/offerings', async (request, response, next) => {
  try {
    const timezone = request.query.timezone ? assertTimezone(String(request.query.timezone)) : undefined;
    const offerings = await offeringService.getTeacherOfferings(request.params.teacherId, timezone);
    response.json({ offerings });
  } catch (error) {
    next(error);
  }
});

app.get('/offerings', async (request, response, next) => {
  try {
    const timezone = assertTimezone(String(request.query.timezone ?? request.header('x-user-timezone') ?? 'UTC'));
    const parentId = request.query.parentId ? String(request.query.parentId) : undefined;
    const offerings = await offeringService.listAvailableOfferings(timezone, parentId);
    response.json({ offerings });
  } catch (error) {
    next(error);
  }
});

app.post('/parents/:parentId/bookings', async (request, response, next) => {
  try {
    const payload = bookOfferingSchema.parse({
      parentId: request.params.parentId,
      offeringId: request.body.offeringId
    });

    const booking = await bookingService.bookOffering(payload);
    response.status(201).json({ booking });
  } catch (error) {
    next(error);
  }
});

app.get('/parents/:parentId/bookings', async (request, response, next) => {
  try {
    const timezone = assertTimezone(String(request.query.timezone ?? request.header('x-user-timezone') ?? 'UTC'));
    const bookings = await bookingService.getParentBookings(request.params.parentId);

    response.json({
      bookings: bookings.map((booking) => ({
        ...booking,
        sessions: booking.sessions.map((session) => ({
          ...session,
          startAtUtc: session.startAt.toISOString(),
          endAtUtc: session.endAt.toISOString(),
          startAt: formatDateTimeInZone(session.startAt, timezone),
          endAt: formatDateTimeInZone(session.endAt, timezone)
        }))
      }))
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message
      }
    });
    return;
  }

  if (error instanceof z.ZodError) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.issues
      }
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected server error'
    }
  });
});

export { app };