"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertTimezone = assertTimezone;
exports.parseLocalDateTime = parseLocalDateTime;
exports.formatDateTimeInZone = formatDateTimeInZone;
exports.overlapExists = overlapExists;
const luxon_1 = require("luxon");
const errors_1 = require("../errors");
function assertTimezone(timezone) {
    if (!luxon_1.IANAZone.isValidZone(timezone)) {
        throw (0, errors_1.badRequest)('INVALID_TIMEZONE', `Invalid IANA timezone: ${timezone}`);
    }
    return timezone;
}
function parseLocalDateTime(value, timezone) {
    const parsed = luxon_1.DateTime.fromISO(value, { zone: timezone });
    if (!parsed.isValid) {
        throw (0, errors_1.badRequest)('INVALID_DATETIME', parsed.invalidExplanation ?? `Invalid date-time value: ${value}`);
    }
    return parsed.toUTC().toJSDate();
}
function formatDateTimeInZone(value, timezone) {
    return luxon_1.DateTime.fromJSDate(value, { zone: 'utc' }).setZone(timezone).toISO({ suppressMilliseconds: true }) ?? value.toISOString();
}
function overlapExists(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && aEnd > bStart;
}
//# sourceMappingURL=time.js.map