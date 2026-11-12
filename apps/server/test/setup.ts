// Provide a complete config env for tests so loadConfig() succeeds. No real Postgres/S3 is
// contacted: the DB client is lazy (pg.Pool connects only on first query) and DB/S3 modules
// are mocked in route tests.
import { setThrowawayEnv } from '../src/throwawayEnv.js';

setThrowawayEnv();
// Tests mock Venice: a key or address exported in the shell (for the live smoke test) must not
// reach them.
delete process.env.VENICE_API_KEY;
delete process.env.VENICE_BASE_URL;
