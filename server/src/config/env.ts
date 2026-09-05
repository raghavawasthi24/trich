import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// z.coerce.boolean() runs `Boolean(value)`, so the string "false" (or any
// non-empty string) coerces to true. Parse "true"/"false" text explicitly instead.
const booleanFromEnv = (defaultValue: boolean) =>
  z.preprocess((v) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v.trim().toLowerCase() === 'true';
    return defaultValue;
  }, z.boolean());

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  TEMPORAL_ADDRESS: z.string().default('localhost:7233'),
  TEMPORAL_NAMESPACE: z.string().default('default'),
  TEMPORAL_TASK_QUEUE: z.string().default('hotel-search'),

  SUPPLIER_A_URL: z.string().default('http://localhost:4000/supplierA/hotels'),
  SUPPLIER_B_URL: z.string().default('http://localhost:4000/supplierB/hotels'),
  SUPPLIER_TIMEOUT_MS: z.coerce.number().int().positive().default(4500),

  AUTH_DISABLED: booleanFromEnv(false).default(false),
  API_TOKEN: z.string().default('dev-token-change-me'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(30),

  MOCK_CHAOS_ENABLED: booleanFromEnv(true).default(true),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('debug'),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

export const corsOrigins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
