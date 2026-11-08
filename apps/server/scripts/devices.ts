/**
 * Lists the installs that synced, with the build each runs (the devices table, docs/sync-design.md
 * §15): which contract versions and builds are still in use before one is retired.
 *
 * Run from apps/server, with .env pointed at the target backend: npm run devices
 * On Fly: npm run devices:prod
 */
import { closeDb, getDb } from '../src/db/client.js';
import { listDevices } from '../src/devices.js';

const rows = await listDevices(getDb());
if (rows.length === 0) console.log('No device recorded yet.');
for (const row of rows) {
  console.log(
    [
      row.device,
      row.email,
      `contract ${row.contract}`,
      `build ${row.build.slice(0, 8)}`,
      `first seen ${row.firstSeenAt.toISOString()}`,
      `last seen ${row.lastSeenAt.toISOString()}`,
    ].join('  '),
  );
}
await closeDb();
