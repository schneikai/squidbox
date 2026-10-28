import { loadConfig } from './config.js';
import { buildApp } from './app.js';
import { closeDb, getDb } from './db/client.js';
import { failAbandonedChecks } from './ai/modelChecks.js';

const config = loadConfig();
const app = await buildApp();
// A model check that was running when the last process stopped never finishes now.
await failAbandonedChecks(getDb());

try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

async function shutdown(signal: string): Promise<void> {
  app.log.info(`Received ${signal}, shutting down`);
  await app.close();
  await closeDb();
  process.exit(0);
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => void shutdown(sig));
}
