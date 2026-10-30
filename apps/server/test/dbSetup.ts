import pg from 'pg';

// The DB runs' global setup: the test database refuses REJECTED_NOTES with a CHECK constraint, a row
// error no record the schema accepts causes. It is added once, if missing, and stays: runs that
// overlap on one Postgres all rely on it, and no real record carries the value.
const CONSTRAINT = 'test_rejected_notes';
/** Notes the test database refuses: a row error. */
export const REJECTED_NOTES = `rejected by ${CONSTRAINT}`;

export default async function setup() {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    await pool.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${CONSTRAINT}') THEN
        ALTER TABLE assets ADD CONSTRAINT ${CONSTRAINT} CHECK (notes IS DISTINCT FROM '${REJECTED_NOTES}') NOT VALID;
      END IF;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`);
  } finally {
    await pool.end();
  }
}
