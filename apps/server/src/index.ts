import { loadConfig } from './config.js';
import { buildApp } from './app.js';
import { closeDb, getDb } from './db/client.js';
import { failAbandonedRuns, failOwnRuns } from './ai/verifyRuns.js';

const config = loadConfig();
const app = await buildApp();

try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// A Verify whose server stopped never finishes now; the boot doesn't wait for this.
failAbandonedRuns(getDb()).catch((err: unknown) => app.log.error({ err }, 'Stopping abandoned Verify runs failed'));

async function shutdown(signal: string): Promise<void> {
  app.log.info(`Received ${signal}, shutting down`);
  await failOwnRuns(getDb()).catch((err: unknown) => app.log.error({ err }, 'Stopping the running Verify runs failed'));
  await app.close();
  await closeDb();
  process.exit(0);
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => void shutdown(sig));
}
