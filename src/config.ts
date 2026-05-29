import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).default('postgres://postgres:postgres@localhost:5432/global_class_booking')
});

const parsedConfig = configSchema.parse(process.env);

export const config = {
  port: parsedConfig.PORT,
  databaseUrl: parsedConfig.DATABASE_URL
};