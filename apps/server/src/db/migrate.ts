import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { collectionNames } from '@squidbox/shared';
import { getDb, closeDb } from './client.js';

// Apply Drizzle migrations, then ensure the global change_seq sequence and attach the
// server_seq trigger to every registered syncable collection's table. Idempotent, so it's
// safe to run on every migrate. The trigger stamps a monotonic server_seq on each
// INSERT/UPDATE — without it a collection's rows would never be pulled (sync-design §3/§9).
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

const db = getDb();
await migrate(db, { migrationsFolder });

await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS change_seq`);
await db.execute(sql`
  CREATE OR REPLACE FUNCTION set_server_seq() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    NEW.server_seq := nextval('change_seq');
    RETURN NEW;
  END;
  $$
`);
for (const name of collectionNames) {
  await db.execute(sql.raw(`DROP TRIGGER IF EXISTS ${name}_server_seq ON "${name}"`));
  await db.execute(
    sql.raw(
      `CREATE TRIGGER ${name}_server_seq BEFORE INSERT OR UPDATE ON "${name}" ` +
        `FOR EACH ROW EXECUTE FUNCTION set_server_seq()`
    )
  );
}

console.log(`Migrations applied; change_seq + server_seq triggers ensured for: ${collectionNames.join(', ')}.`);
await closeDb();
