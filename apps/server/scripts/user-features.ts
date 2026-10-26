/**
 * Shows, grants or takes away an account's features (users.features, ACCOUNT_FEATURES). The app
 * picks a change up on its next launch.
 *
 * Run from apps/server, with .env pointed at the target backend:
 *   npm run user:features -- me@example.com                       (shows them)
 *   npm run user:features -- me@example.com add ai ai_admin
 *   npm run user:features -- me@example.com remove ai_admin
 * On Fly: fly ssh console -C "sh -c 'cd /app/apps/server && npm run user:features:prod -- me@example.com add ai'"
 */
import { ACCOUNT_FEATURES, type AccountFeature } from '@squidbox/shared';
import { getDb, closeDb } from '../src/db/client.js';
import { findUserByEmail, setUserFeatures } from '../src/users.js';

const [email, action, ...names] = process.argv.slice(2);
const usage = `Usage: user:features <email> [add|remove <${ACCOUNT_FEATURES.join('|')}>…]`;
if (!email || (action && action !== 'add' && action !== 'remove') || (action && names.length === 0)) {
  throw new Error(usage);
}
// Only a grant must name a feature the server knows; a retired one can still be taken away.
const unknown = action === 'add' ? names.filter((name) => !ACCOUNT_FEATURES.includes(name as AccountFeature)) : [];
if (unknown.length > 0) throw new Error(`Unknown feature ${unknown.join(', ')}. ${usage}`);

const db = getDb();
const user = await findUserByEmail(db, email);
if (!user) throw new Error(`User not found: ${email}`);

let features = user.features;
if (action) {
  features =
    action === 'add'
      ? [...new Set([...features, ...names])].sort()
      : features.filter((feature) => !names.includes(feature));
  await setUserFeatures(db, user.id, features);
}
console.log(`${email}: ${features.length > 0 ? features.join(', ') : 'no features'}`);
await closeDb();
