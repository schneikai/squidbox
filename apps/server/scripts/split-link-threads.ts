/**
 * Turns an account's posts that end in an OnlyFans or JustFor.Fans link into two-post threads, the
 * rule tried on the library copy: when the first paragraph with such a link isn't the post's first
 * paragraph, the paragraphs before it stay as the first post, and that paragraph and the rest become
 * a following post with the same Posted time. Photos stay on the first post. A post that is deleted,
 * already part of a thread, or has the link in its first paragraph is left as it is.
 *
 * The changes go through the sync push, so they get new server_seq values and every device pulls
 * them like an edit made on another device. Without --apply nothing is written: it prints a summary,
 * and with --backup the account's posts as JSON (stdout) to keep before applying.
 *
 * Run from apps/server, with .env pointed at the target backend:
 *   npm run split:link-threads -- me@example.com [--backup | --apply]
 * On Fly: fly ssh console -C "sh -c 'cd /app/apps/server && npm run split:link-threads:prod -- me@example.com'"
 */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { PushMutation } from '@squidbox/shared';
import { getDb, closeDb } from '../src/db/client.js';
import { posts } from '../src/db/schema.js';
import { serverCollections } from '../src/sync/collections.js';
import { push } from '../src/sync/push.js';
import { findUserByEmail } from '../src/users.js';
import { hasLink, splitAtLink } from './splitAtLink.js';

const [email, mode] = process.argv.slice(2);
if (!email || (mode && mode !== '--apply' && mode !== '--backup')) {
  throw new Error('Usage: split:link-threads <email> [--backup | --apply]');
}

const db = getDb();
const user = await findUserByEmail(db, email);
if (!user) throw new Error(`User not found: ${email}`);

const rows = await db.select(serverCollections.posts!.wireColumns).from(posts).where(eq(posts.userId, user.id));
const all = rows as unknown as Array<Record<string, any> & { id: string; text: string }>;

if (mode === '--backup') {
  process.stdout.write(JSON.stringify(all) + '\n');
  await closeDb();
  process.exit(0);
}

const live = all.filter((post) => post.deletedAt === null);
const roots = new Set(live.flatMap((post) => (post.threadRootId ? [post.threadRootId] : [])));
const candidates = live.filter((post) => !post.threadRootId && !roots.has(post.id));
const splits = candidates.flatMap((post) => {
  const parts = splitAtLink(post.text);
  return parts ? [{ post, ...parts }] : [];
});
const withLink = candidates.filter((post) => hasLink(post.text)).length;

console.log(`${email}: ${live.length} posts, ${live.length - candidates.length} already in a thread`);
console.log(`${withLink} with a link, ${splits.length} to split, ${withLink - splits.length} left alone`);
for (const { post, first, following } of splits.slice(0, 3)) {
  console.log(`\n--- ${post.id}\n[1] ${first}\n[2] ${following}`);
}

if (mode === '--apply' && splits.length > 0) {
  const now = Date.now();
  const mutations: PushMutation[] = splits.flatMap(({ post, first, following }) => [
    { collection: 'posts', record: { ...post, text: first, updatedAt: now }, fields: { text: now } },
    {
      collection: 'posts',
      record: {
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        text: following,
        isFavorite: false,
        postedAt: post.postedAt,
        rePostId: null,
        isIgnoredForRepost: false,
        suggestRepostAt: now,
        hasBeenReposted: false,
        threadRootId: post.id,
        threadIndex: 1,
      },
    },
  ]);
  const results = await push(db, user.id, mutations);
  const notApplied = results.filter((result) => result.status !== 'applied');
  console.log(`\nApplied ${results.length - notApplied.length} of ${results.length} writes`);
  for (const result of notApplied) console.log(JSON.stringify(result));
}
await closeDb();
