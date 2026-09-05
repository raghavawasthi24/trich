import { z } from 'zod';

const EnvSchema = z.object({
  VITE_API_BASE_URL: z.string().url(),
  VITE_API_TOKEN: z.string().min(1),
  VITE_ENABLE_SCENARIOS: z
    .string()
    .optional()
    .transform((v) => v?.trim().toLowerCase() === 'true'),
});

function loadEnv() {
  const parsed = EnvSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid client environment configuration:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid client environment configuration. Check your .env file against .env.example.');
  }
  return parsed.data;
}

export const env = loadEnv();
