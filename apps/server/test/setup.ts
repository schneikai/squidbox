// Provide a complete config env for tests so loadConfig() succeeds. No real Postgres/S3 is
// contacted: the DB client is lazy (pg.Pool connects only on first query) and DB/S3 modules
// are mocked in route tests. These are throwaway test values.
process.env.JWT_SECRET ??= 'test-secret-key';
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
process.env.AWS_REGION ??= 'eu-west-1';
process.env.AWS_ACCESS_KEY_ID ??= 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY ??= 'test-secret-key';
process.env.S3_SHARED_BUCKET ??= 'test-shared-bucket';
process.env.LOG_LEVEL ??= 'silent';
