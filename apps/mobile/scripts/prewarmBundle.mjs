#!/usr/bin/env node
/**
 * Builds the dev client's first iOS bundle in Metro, so the phone doesn't time out waiting for it.
 * Run it after Metro is up and before handing out the tunnel URL. Asks Metro's manifest for the
 * bundle URL the dev client would load and requests it, so the phone's request hits the cache.
 *
 *   node scripts/prewarmBundle.mjs                # Metro on localhost:8081
 *   METRO_PORT=8082 node scripts/prewarmBundle.mjs
 */
const metroUrl = `http://localhost:${process.env.METRO_PORT || 8081}`;
const started = Date.now();

const manifestRes = await fetch(metroUrl, {
  headers: { 'expo-platform': 'ios', accept: 'application/expo+json,application/json' },
}).catch(() => null);
if (!manifestRes?.ok) fail(`Metro isn't answering on ${metroUrl}`);
const { launchAsset } = await manifestRes.json();

// The manifest names the host Metro was asked on; fetch from localhost to stay off the tunnel.
const { pathname, search } = new URL(launchAsset.url);
console.log('▸ Building the first iOS bundle (a minute or two on a cold cache)');
const bundleRes = await fetch(`${metroUrl}${pathname}${search}`);
const bundle = await bundleRes.text();
if (!bundleRes.ok) fail(`Metro couldn't build the bundle:\n${bundle.slice(0, 2000)}`);
console.log(`▸ Bundle ready in ${Math.round((Date.now() - started) / 1000)}s`);

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}
