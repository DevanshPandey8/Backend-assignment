"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conflict = exports.notFound = exports.badRequest = exports.AppError = void 0;
class AppError extends Error {
    statusCode;
    code;
    constructor(statusCode, code, message) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
const badRequest = (code, message) => new AppError(400, code, message);
exports.badRequest = badRequest;
const notFound = (code, message) => new AppError(404, code, message);
exports.notFound = notFound;
const conflict = (code, message) => new AppError(409, code, message);
exports.conflict = conflict;
//# sourceMappingURL=errors.js.map