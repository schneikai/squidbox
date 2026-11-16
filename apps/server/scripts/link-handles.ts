/**
 * Turns the @handles typed in an account's posts into contact mentions, once: each @handle that
 * means exactly one of the account's contacts becomes that contact's name in the text, with a
 * mention at its place (linkTypedHandles). A handle no contact has first gets a new contact, named
 * as the handle (without its @) with it as the X handle. A handle that means several contacts stays text.
 * Deleted posts and deleted contacts are left out.
 *
 * The changes go through the sync push, so they get new server_seq values and every device pulls
 * them like an edit made on another device. Without --apply nothing is written: it prints every
 * post it would change, before and after, and the handles it leaves as text with the reason; with
 * --backup the account's posts as JSON (stdout) to keep before applying.
 *
 * Run from apps/server, with .env pointed at the target backend:
 *   npm run link:handles -- me@example.com [--alias old=new ...] [--backup | --apply]
 * On Fly: fly ssh console -C "sh -c 'cd /app/apps/server && npm run link:handles:prod -- me@example.com'"
 */
import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { type ContactRecord, type PostMention, type PushMutation, contactsByHandle, handleKey } from '@squidbox/shared';
import { getDb, closeDb } from '../src/db/client.js';
import { contacts, posts } from '../src/db/schema.js';
import { serverCollections } from '../src/sync/collections.js';
import { push } from '../src/sync/push.js';
import { findUserByEmail } from '../src/users.js';
import { type HandleContact, type LeftAsText, linkTypedHandles } from './linkTypedHandles.js';

// `--alias old=new` (repeatable): a handle someone used before, read as the contact named `new` (or with
// `new` as a handle),
// for this run only.
const [email, ...flags] = process.argv.slice(2);
const mode = flags.find((flag) => flag === '--apply' || flag === '--backup');
const aliases = flags.flatMap((flag, i) => (flags[i - 1] === '--alias' ? [flag.split('=')] : []));
const known = new Set(['--apply', '--backup', '--alias', ...flags.filter((_, i) => flags[i - 1] === '--alias')]);
if (!email || flags.some((flag) => !known.has(flag)) || aliases.some((pair) => pair.length !== 2)) {
  throw new Error('Usage: link:handles <email> [--alias old=new ...] [--backup | --apply]');
}

const db = getDb();
const user = await findUserByEmail(db, email);
if (!user) throw new Error(`User not found: ${email}`);

const rows = await db.select(serverCollections.posts!.wireColumns).from(posts).where(eq(posts.userId, user.id));
// The wire record of a post, as the push takes it back.
const all = rows as unknown as Array<
  Record<string, any> & { id: string; text: string; mentions: PostMention[] | null }
>;

if (mode === '--backup') {
  process.stdout.write(JSON.stringify(all) + '\n');
  await closeDb();
  process.exit(0);
}

const people = (await db
  .select(serverCollections.contacts!.wireColumns)
  .from(contacts)
  .where(and(eq(contacts.userId, user.id), isNull(contacts.deletedAt)))) as unknown as HandleContact[];

const live = all.filter((post) => post.deletedAt === null);
// A new contact for a handle no contact has: named as the handle, with it as the X handle.
const now = Date.now();
const created = new Map<string, ContactRecord>();
const newContact = (handle: string): ContactRecord => {
  const bare = handle.replace(/^@/, '');
  const key = handleKey(bare);
  const record =
    created.get(key) ??
    ({
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      name: bare,
      isFavorite: false,
      favoritedAt: null,
      notes: null,
      xHandle: bare,
      blueskyHandle: null,
      instagramHandle: null,
      onlyFansHandle: null,
      jffHandle: null,
      phoneNumber: null,
      places: [],
      avatarFilename: null,
    } as ContactRecord);
  created.set(key, record);
  return record;
};

// An alias's new handle no contact has gets a new contact too, which the old one then links to.
const byHandle = contactsByHandle(people);
for (const [old, to] of aliases) {
  const named = people.filter(({ name }) => name === to);
  const found = named.length > 0 ? named : byHandle(to!);
  if (found.length > 1) throw new Error(`--alias ${old}=${to}: ${found.length} contacts have ${to}`);
  const contact: HandleContact = found[0] ?? (newContact(to!) as HandleContact);
  console.log(`Alias: @${old!.replace(/^@/, '')} → ${contact.name}${found.length === 0 ? ' (new contact)' : ''}`);
  people.push({ id: contact.id, name: contact.name, xHandle: old!.replace(/^@/, '') });
}

// A new contact for each handle no contact has, one per handle under any spelling.
const knownHandle = contactsByHandle(people);
for (const { left } of live.map((post) => linkTypedHandles(post, people))) {
  for (const { handle, reason } of left) {
    if (reason === 'no contact' && knownHandle(handle).length === 0) newContact(handle);
  }
}
const everyone = [...people, ...(created.values() as Iterable<HandleContact>)];
const read = live.map((post) => ({ post, ...linkTypedHandles(post, everyone) }));
const changes = read.flatMap(({ post, linked }) => (linked ? [{ post, linked }] : []));

console.log(`${email}: ${live.length} posts, ${people.length} contacts`);
console.log(
  `${created.size} contacts to create: ${[...created.values()].map(({ name }) => name).join(', ')}\n` +
    `${changes.length} posts to change, ${changes.reduce((n, { post, linked }) => n + linked.mentions.length - (post.mentions?.length ?? 0), 0)} mentions to add`,
);
for (const { post, linked } of changes) {
  const names = linked.mentions.map(({ name }) => name).join(', ');
  console.log(`\n--- ${post.id}\nBEFORE: ${post.text}\nAFTER:  ${linked.text}\nMENTIONS: ${names}`);
}

const left = new Map<string, { entry: LeftAsText; posts: number }>();
for (const entry of read.flatMap((one) => one.left)) {
  const key = `${entry.handle.toLowerCase()} ${entry.reason}`;
  left.set(key, { entry, posts: (left.get(key)?.posts ?? 0) + 1 });
}
console.log(`\n${left.size} handles left as text:`);
for (const { entry, posts: count } of [...left.values()].sort((a, b) => b.posts - a.posts)) {
  console.log(`${entry.handle} (${count}x): ${entry.reason}${entry.names ? ` (${entry.names.join(', ')})` : ''}`);
}

if (mode === '--apply' && changes.length > 0) {
  const mutations: PushMutation[] = [
    ...[...created.values()].map((record): PushMutation => ({ collection: 'contacts', record })),
    ...changes.map(({ post, linked }) => ({
      collection: 'posts',
      record: { ...post, ...linked, updatedAt: now },
      fields: { text: now, mentions: now },
    })),
  ];
  const results = await push(db, user.id, mutations);
  const notApplied = results.filter((result) => result.status !== 'applied');
  console.log(`\nApplied ${results.length - notApplied.length} of ${results.length} writes`);
  for (const result of notApplied) console.log(JSON.stringify(result));
}
await closeDb();
