import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { loadConfig } from '../config.js';
import * as schema from './schema.js';

// One shared pool + Drizzle instance for the process.
let pool: pg.Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const url = loadConfig().DATABASE_URL;
    // Managed Postgres (Neon, etc.) requires TLS; local docker/Fly-internal don't. Enable SSL when
    // the URL asks for it or points at a known managed host.
    const needsSsl = /[?&]sslmode=require/i.test(url) || /\.neon\.tech|\.flympg\.net/i.test(url);
    pool = new pg.Pool({
      connectionString: url,
      ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    });
  }
  return pool;
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

export type Db = ReturnType<typeof getDb>;

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
  }
}
