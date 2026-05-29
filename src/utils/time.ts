import { DateTime, IANAZone } from 'luxon';
import { badRequest } from '../errors';

export function assertTimezone(timezone: string): string {
  if (!IANAZone.isValidZone(timezone)) {
    throw badRequest('INVALID_TIMEZONE', `Invalid IANA timezone: ${timezone}`);
  }

  return timezone;
}

export function parseLocalDateTime(value: string, timezone: string): Date {
  const parsed = DateTime.fromISO(value, { zone: timezone });

  if (!parsed.isValid) {
    throw badRequest('INVALID_DATETIME', parsed.invalidExplanation ?? `Invalid date-time value: ${value}`);
  }

  return parsed.toUTC().toJSDate();
}

export function formatDateTimeInZone(value: Date, timezone: string): string {
  return DateTime.fromJSDate(value, { zone: 'utc' }).setZone(timezone).toISO({ suppressMilliseconds: true }) ?? value.toISOString();
}

export function overlapExists(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}