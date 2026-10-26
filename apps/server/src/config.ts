import { z } from 'zod';

// Fail fast at boot if required config is missing/invalid.
const envSchema = z.object({
  PORT: z.coerce.number().default(3100),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  // Stable identity of this deployment, reported by /up, login and /me so the app can bind a
  // session and its library to the server it belongs to.
  SERVER_ID: z.string({ required_error: 'SERVER_ID is required' }).uuid('SERVER_ID must be a uuid'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  AWS_REGION: z.string().default('eu-west-1'),
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required'),
  S3_SHARED_BUCKET: z.string().min(1, 'S3_SHARED_BUCKET is required'),
  // Local dev only: point S3 at a MinIO/LocalStack endpoint (path-style). Leave unset for AWS.
  S3_ENDPOINT: z.string().url().optional(),
  // Local dev only: public address of that endpoint, used to sign download URLs that a phone can
  // reach (e.g. through a tunnel). Defaults to S3_ENDPOINT.
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // AI (Venice). Without a key the server runs and the AI endpoints answer 503
  // ai_not_configured; the key never leaves the server.
  // An empty value counts as unset.
  VENICE_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  VENICE_BASE_URL: z.string().url().default('https://api.venice.ai/api/v1'),
});

export type Config = z.infer<typeof envSchema>;

let cached: Config | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (cached) return cached;
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid server configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
