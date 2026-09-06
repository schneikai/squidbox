import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb, closeDb } from './client.js';

// Apply Drizzle migrations, then ensure the global change_seq sequence exists (used from
// Phase 2 — every syncable row gets a monotonic server_seq stamped by a trigger).
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

const db = getDb();
await migrate(db, { migrationsFolder });
await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS change_seq`);
console.log('Migrations applied; change_seq ensured.');
await closeDb();
