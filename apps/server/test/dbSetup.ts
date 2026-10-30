import pg from 'pg';

// The DB runs' global setup: the test database refuses REJECTED_NOTES with a CHECK constraint, a row
// error no record the schema accepts causes, added once for the run so no test locks the assets table
// to add it.
const CONSTRAINT = 'test_rejected_notes';
/** Notes the test database refuses: a row error. */
export const REJECTED_NOTES = `rejected by ${CONSTRAINT}`;

async function query(sql: string) {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    await pool.query(sql);
  } finally {
    await pool.end();
  }
}

export default async function setup() {
  await query(`ALTER TABLE assets DROP CONSTRAINT IF EXISTS ${CONSTRAINT}`);
  await query(
    `ALTER TABLE assets ADD CONSTRAINT ${CONSTRAINT} CHECK (notes IS DISTINCT FROM '${REJECTED_NOTES}') NOT VALID`,
  );
  return () => query(`ALTER TABLE assets DROP CONSTRAINT IF EXISTS ${CONSTRAINT}`);
}
