"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const configSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().int().positive().default(3000),
    DATABASE_URL: zod_1.z.string().min(1).default('postgres://postgres:postgres@localhost:5432/global_class_booking')
});
const parsedConfig = configSchema.parse(process.env);
exports.config = {
    port: parsedConfig.PORT,
    databaseUrl: parsedConfig.DATABASE_URL
};
//# sourceMappingURL=config.js.map