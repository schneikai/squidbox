/**
 * A complete config env of throwaway values, so loadConfig() succeeds where no real Postgres or S3 is
 * contacted: the tests (test/setup.ts) and the contract snapshot (scripts/contract-snapshot.ts), which
 * build the app this way alike. A value already set is kept.
 */
export function setThrowawayEnv(): void {
  process.env.JWT_SECRET ??= 'test-secret-key';
  process.env.SERVER_ID ??= '0f3a1b2c-4d5e-4f60-8a7b-9c0d1e2f3a4b';
  process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
  process.env.AWS_REGION ??= 'eu-west-1';
  process.env.AWS_ACCESS_KEY_ID ??= 'test-access-key';
  process.env.AWS_SECRET_ACCESS_KEY ??= 'test-secret-key';
  process.env.S3_SHARED_BUCKET ??= 'test-shared-bucket';
  process.env.LOG_LEVEL ??= 'silent';
}
