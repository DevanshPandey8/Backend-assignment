"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const errors_1 = require("./errors");
const bookingService_1 = require("./services/bookingService");
const offeringService_1 = require("./services/offeringService");
const time_1 = require("./utils/time");
const createOfferingSchema = zod_1.z.object({
    courseName: zod_1.z.string().min(1),
    title: zod_1.z.string().min(1),
    teacherId: zod_1.z.string().min(1),
    teacherTimezone: zod_1.z.string().min(1)
});
const createSessionsSchema = zod_1.z.object({
    sessions: zod_1.z.array(zod_1.z.object({
        startAt: zod_1.z.string().min(1),
        endAt: zod_1.z.string().min(1)
    })).min(1)
});
const bookOfferingSchema = zod_1.z.object({
    parentId: zod_1.z.string().min(1),
    offeringId: zod_1.z.string().uuid()
});
const app = (0, express_1.default)();
exports.app = app;
app.use(express_1.default.json());
app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
});
app.post('/teachers/offerings', async (request, response, next) => {
    try {
        const payload = createOfferingSchema.parse(request.body);
        const offering = await offeringService_1.offeringService.createOffering(payload);
        response.status(201).json({ offering });
    }
    catch (error) {
        next(error);
    }
});
app.post('/teachers/offerings/:offeringId/sessions', async (request, response, next) => {
    try {
        const offeringId = request.params.offeringId;
        const payload = createSessionsSchema.parse(request.body);
        const sessions = await offeringService_1.offeringService.addSessions(offeringId, payload.sessions);
        response.status(201).json({ sessions });
    }
    catch (error) {
        next(error);
    }
});
app.get('/teachers/:teacherId/offerings', async (request, response, next) => {
    try {
        const timezone = request.query.timezone ? (0, time_1.assertTimezone)(String(request.query.timezone)) : undefined;
        const offerings = await offeringService_1.offeringService.getTeacherOfferings(request.params.teacherId, timezone);
        response.json({ offerings });
    }
    catch (error) {
        next(error);
    }
});
app.get('/offerings', async (request, response, next) => {
    try {
        const timezone = (0, time_1.assertTimezone)(String(request.query.timezone ?? request.header('x-user-timezone') ?? 'UTC'));
        const parentId = request.query.parentId ? String(request.query.parentId) : undefined;
        const offerings = await offeringService_1.offeringService.listAvailableOfferings(timezone, parentId);
        response.json({ offerings });
    }
    catch (error) {
        next(error);
    }
});
app.post('/parents/:parentId/bookings', async (request, response, next) => {
    try {
        const payload = bookOfferingSchema.parse({
            parentId: request.params.parentId,
            offeringId: request.body.offeringId
        });
        const booking = await bookingService_1.bookingService.bookOffering(payload);
        response.status(201).json({ booking });
    }
    catch (error) {
        next(error);
    }
});
app.get('/parents/:parentId/bookings', async (request, response, next) => {
    try {
        const timezone = (0, time_1.assertTimezone)(String(request.query.timezone ?? request.header('x-user-timezone') ?? 'UTC'));
        const bookings = await bookingService_1.bookingService.getParentBookings(request.params.parentId);
        response.json({
            bookings: bookings.map((booking) => ({
                ...booking,
                sessions: booking.sessions.map((session) => ({
                    ...session,
                    startAtUtc: session.startAt.toISOString(),
                    endAtUtc: session.endAt.toISOString(),
                    startAt: (0, time_1.formatDateTimeInZone)(session.startAt, timezone),
                    endAt: (0, time_1.formatDateTimeInZone)(session.endAt, timezone)
                }))
            }))
        });
    }
    catch (error) {
        next(error);
    }
});
app.use((error, _request, response, _next) => {
    if (error instanceof errors_1.AppError) {
        response.status(error.statusCode).json({
            error: {
                code: error.code,
                message: error.message
            }
        });
        return;
    }
    if (error instanceof zod_1.z.ZodError) {
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
//# sourceMappingURL=app.js.map