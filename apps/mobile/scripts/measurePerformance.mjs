/* eslint-env node, browser */
/**
 * Measures the web preview's release bundle: the first sync of a fresh browser → first grid cell,
 * reload → first grid cell, idle JS heap, and the main-thread script time of a favorite toggle. Needs `npm run dev:local -- --web` running; for a
 * large library, first run `npm run seed:mock -- --assets 50000` in apps/server.
 *
 *   npm run web:measure
 */
import { openWebPreview, settleAsync } from './webPreview.mjs';

const RELOADS = 3;
const TOGGLES = 3;
const WINDOW_MS = 3000;

const syncStart = Date.now();
const { page, errors, close } = await openWebPreview({ production: true });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');
const cells = page.getByTestId('asset-cell');
const firstCell = () => cells.first().waitFor({ timeout: 600_000 });
await firstCell();
console.log(`first sync → first cell: ${((Date.now() - syncStart) / 1000).toFixed(1)} s`);

for (let i = 0; i < RELOADS; i++) {
  const start = Date.now();
  await page.reload();
  await firstCell();
  console.log(`reload → first cell: ${Date.now() - start} ms`);
}

await settleAsync(page);
await cdp.send('HeapProfiler.collectGarbage');
const { usedSize } = await cdp.send('Runtime.getHeapUsage');
console.log(`idle JS heap: ${(usedSize / 1e6).toFixed(1)} MB`);

// Script time in a window after a double tap, minus the same window idle: includes the push and
// the refresh it triggers.
const idleScriptMs = await scriptMsDuring(async () => {});
for (let i = 0; i < TOGGLES; i++) {
  const ms = await scriptMsDuring(() => cells.nth(i + 6).dblclick());
  console.log(`favorite toggle: ${Math.max(0, ms - idleScriptMs).toFixed(0)} ms script`);
}

if (errors.length > 0) console.log(`Console errors:\n${errors.join('\n')}`);
await close();

async function scriptMsDuring(action) {
  const before = await totalScriptMs();
  await action();
  await page.waitForTimeout(WINDOW_MS);
  return (await totalScriptMs()) - before;
}

async function totalScriptMs() {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return metrics.find((metric) => metric.name === 'ScriptDuration').value * 1000;
}
