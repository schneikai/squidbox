/**
 * Tags each post's photos with the contacts its text mentions, once: for every live post with
 * mentions, every live photo or video of the post gets a contact link (`targetType: 'asset'`) to
 * each mentioned live contact. A tag that is already on the photo stays as it is; one the account
 * took off before (a tombstoned link) is left off and listed. Deleted posts, photos and contacts
 * are left out.
 *
 * The links go through the sync push, so every device pulls them like a tag made on another
 * device. Without --apply nothing is written: it prints every post with the photos and contacts it
 * would tag.
 *
 * Run from apps/server, with .env pointed at the target backend:
 *   node --env-file=.env --import tsx scripts/tag-mentioned.ts me@example.com [--apply]
 */
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { type PostMention, type PushMutation, PUSH_MAX_MUTATIONS } from '@squidbox/shared';
import { getDb, closeDb } from '../src/db/client.js';
import { assets, contactLinks, contacts, postAssets, posts } from '../src/db/schema.js';
import { push } from '../src/sync/push.js';
import { findUserByEmail } from '../src/users.js';

const [email, ...flags] = process.argv.slice(2);
if (!email || flags.some((flag) => flag !== '--apply')) throw new Error('Usage: tag-mentioned <email> [--apply]');
const apply = flags.includes('--apply');

const db = getDb();
const user = await findUserByEmail(db, email);
if (!user) throw new Error(`User not found: ${email}`);
const userId = user.id;

const mentioned = (
  await db
    .select({ id: posts.id, text: posts.text, mentions: posts.mentions })
    .from(posts)
    .where(and(eq(posts.userId, userId), isNull(posts.deletedAt)))
).filter((post) => (post.mentions as PostMention[] | null)?.length);

const liveContacts = new Map(
  (
    await db
      .select({ id: contacts.id, name: contacts.name })
      .from(contacts)
      .where(and(eq(contacts.userId, userId), isNull(contacts.deletedAt)))
  ).map(({ id, name }) => [id, name]),
);

const postIds = mentioned.map(({ id }) => id);
const edges =
  postIds.length === 0
    ? []
    : await db
        .select({ postId: postAssets.postId, assetId: postAssets.assetId, position: postAssets.position })
        .from(postAssets)
        .innerJoin(assets, and(eq(assets.userId, postAssets.userId), eq(assets.id, postAssets.assetId)))
        .where(
          and(
            eq(postAssets.userId, userId),
            isNull(postAssets.deletedAt),
            inArray(postAssets.postId, postIds),
            isNull(assets.deletedAt),
            isNull(assets.purgedAt),
          ),
        );
const photosOf = new Map<string, string[]>();
for (const edge of edges.sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0))) {
  const list = photosOf.get(edge.postId) ?? [];
  if (!list.includes(edge.assetId)) list.push(edge.assetId);
  photosOf.set(edge.postId, list);
}
const mediaType = new Map(
  (await db.select({ id: assets.id, mediaType: assets.mediaType }).from(assets).where(eq(assets.userId, userId))).map(
    ({ id, mediaType: type }) => [id, type],
  ),
);

// Every photo link the account has: live ones are kept, tombstoned ones were taken off on purpose.
const links = await db
  .select({ contactId: contactLinks.contactId, targetId: contactLinks.targetId, deletedAt: contactLinks.deletedAt })
  .from(contactLinks)
  .where(and(eq(contactLinks.userId, userId), eq(contactLinks.targetType, 'asset')));
const key = (contactId: string, assetId: string) => `${contactId}:${assetId}`;
const onPhoto = new Set(links.filter((l) => l.deletedAt === null).map((l) => key(l.contactId, l.targetId)));
const takenOff = new Set(links.filter((l) => l.deletedAt !== null).map((l) => key(l.contactId, l.targetId)));

const now = Date.now();
const toAdd = new Map<string, { contactId: string; assetId: string }>();
let already = 0;
let noPhotos = 0;
let deletedContact = 0;
const removedBefore: string[] = [];
const report: string[] = [];
const withoutPhotos: string[] = [];
const contactsTagged = new Map<string, number>();

for (const post of mentioned) {
  const photos = photosOf.get(post.id) ?? [];
  const ids = [...new Set((post.mentions as PostMention[]).map(({ contactId }) => contactId))];
  if (photos.length === 0) {
    noPhotos++;
    const names = ids.map((id) => liveContacts.get(id) ?? 'deleted contact').join(', ');
    withoutPhotos.push(`${post.id}: ${names}\n  ${post.text.slice(0, 120)}`);
    continue;
  }
  const lines: string[] = [];
  for (const contactId of ids) {
    const name = liveContacts.get(contactId);
    if (name === undefined) {
      deletedContact++;
      lines.push(`  ${contactId}: contact deleted, skipped`);
      continue;
    }
    const adding: string[] = [];
    let has = 0;
    for (const assetId of photos) {
      const k = key(contactId, assetId);
      if (onPhoto.has(k)) has++;
      else if (takenOff.has(k)) removedBefore.push(`${name} on ${assetId} (post ${post.id})`);
      else if (!toAdd.has(k)) {
        toAdd.set(k, { contactId, assetId });
        adding.push(assetId);
        contactsTagged.set(name, (contactsTagged.get(name) ?? 0) + 1);
      }
    }
    already += has;
    lines.push(
      `  ${name}: ${adding.length} to tag${has ? `, ${has} already tagged` : ''}` +
        (adding.length ? ` [${adding.map((id) => `${id.slice(0, 8)} ${mediaType.get(id)}`).join(', ')}]` : ''),
    );
  }
  if (lines.some((line) => line.includes(' to tag [')))
    report.push(`\n--- ${post.id} (${photos.length} photos/videos)\n${post.text.slice(0, 120)}\n${lines.join('\n')}`);
}

const videos = [...toAdd.values()].filter(({ assetId }) => mediaType.get(assetId) === 'video').length;
console.log(`${email}: ${mentioned.length} posts with mentions, ${noPhotos} of them without photos`);
console.log(
  `${toAdd.size} tags to add (${toAdd.size - videos} on photos, ${videos} on videos) for ${contactsTagged.size} contacts, ` +
    `on ${new Set([...toAdd.values()].map(({ assetId }) => assetId)).size} photos/videos`,
);
console.log(`${already} already tagged, skipped`);
console.log(`${removedBefore.length} taken off before, left off`);
for (const line of removedBefore) console.log(`  ${line}`);
if (deletedContact) console.log(`${deletedContact} mentions of a deleted contact, skipped`);
console.log(`\nTags per contact:`);
for (const [name, count] of [...contactsTagged].sort((a, b) => b[1] - a[1])) console.log(`  ${name}: ${count}`);
console.log(`\nPosts with mentions but no photos or videos (nothing to tag):`);
for (const line of withoutPhotos) console.log(`  ${line}`);
console.log(`\nPosts that get tags:`);
console.log(report.join('\n'));

if (apply && toAdd.size > 0) {
  const mutations: PushMutation[] = [...toAdd.values()].map(({ contactId, assetId }) => ({
    collection: 'contact_links',
    record: {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      contactId,
      targetType: 'asset',
      targetId: assetId,
    },
  }));
  let applied = 0;
  for (let i = 0; i < mutations.length; i += PUSH_MAX_MUTATIONS) {
    const results = await push(db, userId, mutations.slice(i, i + PUSH_MAX_MUTATIONS));
    applied += results.filter((result) => result.status === 'applied').length;
    for (const result of results.filter((r) => r.status !== 'applied')) console.log(JSON.stringify(result));
  }
  console.log(`\nApplied ${applied} of ${mutations.length} tags`);
}
await closeDb();
