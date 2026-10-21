import { describe, it, expect } from 'vitest';
import {
  assetCollection,
  mergeFields,
  mergeRecord,
  restoredMark,
  widenToGroups,
  type FieldClocks,
} from '@squidbox/shared';
import { serverCollections } from '../src/sync/collections.js';
import { sentFields } from '../src/sync/sentFields.js';

// Property-style tests of the merge (sync-design §5–§7): random edits, deletes, restores and purges
// from three devices with random clock skew, random push/pull interleavings, lost push responses
// and old apps (whole-record pushes, main's pull that skips a pending record), against a model of
// the server around mergeRecord. Every case is seeded: a failure names its seed, and
// `REPLAY=<seed> npx vitest run test/mergeRecord.property.test.ts -t none` reruns just that case,
// printing its steps.

type Rec = Record<string, any> & {
  id: string;
  updatedAt: number;
  deletedAt: number | null;
  purgedAt?: number | null;
};
type Mutation = { record: Rec; fields?: FieldClocks };
type Result = { status: 'applied' | 'skipped-lww'; current?: Rec };

const col = serverCollections.assets!;
const MERGE = mergeFields(assetCollection);
const FLAGS = ['isFileSynced', 'isThumbnailSynced', 'isSynced'];
const REGISTERS = ['notes', 'isFavorite', 'mediaType', ...FLAGS]; // merge fields outside the deletion pair
const HOUR = 3_600_000;
const T0 = 1_800_000_000_000;

function prng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!,
    chance: (p: number) => next() < p,
  };
}

// The server's stored clocks (push.ts `storedClocks`): a clocked field without one, or every one
// when a server without clocks wrote the row since (its updated_at is newer than all of them), takes
// updated_at; restore marks are kept.
function storedClocks(updatedAt: number, fieldClock: FieldClocks | null): FieldClocks {
  const base = Object.fromEntries(col.clockedFields.map((field) => [field, updatedAt]));
  if (!fieldClock) return base;
  const known = col.clockedFields.flatMap((field) => (field in fieldClock ? [fieldClock[field]!] : []));
  if (known.length === 0 || updatedAt > Math.max(...known)) return { ...fieldClock, ...base };
  return { ...base, ...fieldClock };
}

const synced = (record: Record<string, unknown>) =>
  Object.fromEntries(['id', 'createdAt', 'updatedAt', ...MERGE].map((k) => [k, record[k] ?? null]));
const marksOf = (clocks: FieldClocks) => Object.keys(clocks).filter((key) => key.startsWith('deletedAt:restored:'));

interface Server {
  record: Rec;
  fieldClock: FieldClocks | null;
  seq: number;
  /** The deletedAt values a restore undid on this server (the transitions deleted → live). */
  restored: Set<number>;
  /** The newest clock and value each register field got, by any push that reached an unfrozen row. */
  oracle: Map<string, { clock: number; value: unknown }>;
  /** Between rollback steps: the server from before per-field merge (whole-record LWW, field_clock untouched). */
  old: boolean;
}

interface Device {
  name: string;
  skew: number;
  /** An app from before per-field merge: no `fields`, and main's pull, which skips a record with a pending row. */
  old: boolean;
  /** An app from before purges: neither sends purgedAt nor purges. */
  prePurge: boolean;
  local: Rec;
  outbox: { payload: Rec; fields: FieldClocks } | null;
  cursor: number;
  /** A push whose response was lost ends the run: the next run pushes again before it pulls. */
  unanswered: boolean;
}

const stats = { purgeOverRedelete: 0, purged: 0, restoredThenPurgeLost: 0 };

function runCase(seed: number, steps: number, log?: string[]): string[] {
  const rand = prng(seed);
  const violations: string[] = [];
  const fail = (step: number, message: string) => violations.push(`seed ${seed} step ${step}: ${message}`);
  let now = T0;
  let seq = 0;

  const initial: Rec = {
    id: 'a',
    createdAt: T0,
    updatedAt: T0,
    mediaLibraryAssetId: 'm',
    mediaType: 'photo',
    width: 1,
    height: 1,
    fileSize: 1,
    duration: null,
    filename: 'f.jpg',
    thumbnailFilename: 't.jpg',
    isFavorite: false,
    notes: null,
    oldFileId: null,
    isFileSynced: false,
    isThumbnailSynced: false,
    isSynced: false,
    deletedAt: null,
    purgedAt: null,
  };
  const server: Server = {
    record: initial,
    fieldClock: Object.fromEntries(col.clockedFields.map((f) => [f, T0])),
    seq: ++seq,
    restored: new Set(),
    oracle: new Map(REGISTERS.map((f) => [f, { clock: T0, value: initial[f] }])),
    old: false,
  };
  const skews = [0, 0, 0, HOUR, -HOUR, 5_000, -5_000, 1, -1];
  const devices: Device[] = ['A', 'B', 'C'].map((name, i) => {
    const old = i === 2 ? rand.chance(0.5) : i === 1 && rand.chance(0.1);
    return {
      name,
      skew: rand.pick(skews),
      old,
      prePurge: old && rand.chance(0.3),
      local: { ...initial },
      outbox: null,
      cursor: server.seq,
      unanswered: false,
    };
  });

  // ── The server: a push, as push.ts merges it (or main's whole-record LWW while rolled back).
  function serverPush(step: number, mutation: Mutation): Result {
    const record: Rec = { ...mutation.record, updatedAt: Math.min(mutation.record.updatedAt, now) };
    if (server.old) return oldServerPush(record);
    const fields = sentFields(col, mutation.record as never, mutation.fields, now);
    const before = server.record;
    const clocksBefore = storedClocks(before.updatedAt, server.fieldClock);
    const wholeRecord = mutation.fields === undefined;
    log?.push(
      `  push ${JSON.stringify({ u: record.updatedAt - T0, d: record.deletedAt, p: record.purgedAt, fields })} onto ${JSON.stringify({ u: server.record.updatedAt - T0, d: server.record.deletedAt, p: server.record.purgedAt })}`,
    );
    const merged = mergeRecord(assetCollection, {
      stored: before,
      storedClocks: clocksBefore,
      sent: record,
      sentClocks: fields,
      wholeRecord,
    });
    const frozen = before.purgedAt != null;
    if (frozen && merged.applied.length > 0) fail(step, `a frozen row took ${merged.applied}`);

    // The registers: each takes the value of the newest clock that reached it (strict >).
    if (!frozen)
      for (const field of REGISTERS) {
        if (!(field in fields)) continue;
        const best = server.oracle.get(field)!;
        if (fields[field]! > best.clock) server.oracle.set(field, { clock: fields[field]!, value: record[field] });
      }

    // The deletion pair, by the rules of §7.
    if (!frozen) {
      const sentPurge = record.purgedAt != null && record.deletedAt != null;
      const newer = 'deletedAt' in fields && fields.deletedAt! > clocksBefore.deletedAt!;
      const after = merged.record;
      if (!sentPurge && 'deletedAt' in fields) {
        const expected = newer ? record.deletedAt : before.deletedAt;
        if (after.deletedAt !== expected)
          fail(step, `deletedAt ${after.deletedAt}, expected ${expected} (newer: ${newer})`);
        if (after.purgedAt != null) fail(step, 'a push without a purge purged');
      }
      if (sentPurge) {
        const madeOfRestored = before.deletedAt == null && server.restored.has(record.deletedAt!) && !wholeRecord;
        const expectPurged = !madeOfRestored && (newer || before.deletedAt != null);
        if (madeOfRestored) stats.restoredThenPurgeLost++;
        if ((after.purgedAt != null) !== expectPurged)
          fail(
            step,
            `purge ${expectPurged ? 'lost' : 'applied'}: stored deletedAt ${before.deletedAt}, sent ${record.deletedAt}, newer ${newer}`,
          );
        if (
          !wholeRecord &&
          before.deletedAt == null &&
          after.purgedAt != null &&
          server.restored.has(record.deletedAt!)
        )
          fail(step, 'a purge applied over a restore of its deletion');
        if (
          !wholeRecord &&
          before.deletedAt != null &&
          after.purgedAt != null &&
          server.restored.has(record.deletedAt!)
        )
          stats.purgeOverRedelete++;
      }
    }

    if (!frozen)
      for (const field of REGISTERS)
        if (!Object.is(merged.record[field], server.oracle.get(field)!.value))
          fail(step, `${field} is ${merged.record[field]}, but the newest edit was ${server.oracle.get(field)!.value}`);
    if (merged.applied.length > 0) {
      const changed =
        JSON.stringify(synced(merged.record)) !== JSON.stringify(synced(before)) ||
        JSON.stringify(merged.clocks) !== JSON.stringify(clocksBefore);
      if (!changed) fail(step, 'a write that changed nothing (a new server_seq for nothing)');
      if (before.deletedAt != null && merged.record.deletedAt == null) {
        server.restored.add(before.deletedAt);
        if (!(restoredMark(before.deletedAt) in merged.clocks)) fail(step, 'a restore left no mark');
      }
      server.record = { ...(merged.record as Rec), purgedAt: (merged.record.purgedAt as number | null) ?? null }; // a column: null when unsent
      server.fieldClock = merged.clocks;
      server.seq = ++seq;
    }
    for (const key of Object.keys(merged.record)) if (key.includes(':')) fail(step, `a mark in the record: ${key}`);
    for (const value of server.restored)
      if (!(restoredMark(value) in (server.fieldClock ?? {}))) fail(step, `the mark of ${value} is gone`);
    if (merged.applied.length > 0) {
      const max = Math.max(...col.clockedFields.map((f) => merged.clocks[f] ?? 0));
      if (merged.record.updatedAt !== max)
        fail(step, `updated_at ${merged.record.updatedAt} is not the newest clock ${max}`);
    }

    // checkResults (§6): applied means every sent field holds; skipped-lww carries the row.
    const lost = Object.keys(fields).filter((f) => !Object.is(server.record[f] ?? null, record[f] ?? null));
    const purgeMissing = server.record.purgedAt != null && !Object.is(server.record.purgedAt, record.purgedAt ?? null);
    if (merged.lost.length === 0 && (lost.length > 0 || purgeMissing)) fail(step, `applied, but lost ${lost}`);
    if (merged.lost.length > 0 && lost.length === 0 && !purgeMissing) fail(step, 'skipped-lww, but every field holds');
    return merged.lost.length > 0 ? { status: 'skipped-lww', current: server.record } : { status: 'applied' };
  }

  // main's push: the newer record wins whole, a purge also applies over a record in the Deleted
  // album, nothing over a purged one; field_clock is left as it was.
  function oldServerPush(record: Rec): Result {
    const stored = server.record;
    const applies =
      stored.purgedAt == null &&
      (record.updatedAt > stored.updatedAt || (record.purgedAt != null && stored.deletedAt != null));
    if (!applies) return { status: 'skipped-lww', current: stored };
    server.record = { ...stored, ...record };
    server.seq = ++seq;
    for (const field of REGISTERS) server.oracle.set(field, { clock: record.updatedAt, value: server.record[field] });
    return { status: 'applied' };
  }

  // ── A device.
  function write(device: Device, changes: Partial<Rec>) {
    const prev = device.local;
    const updatedAt = Math.max(now + device.skew, prev.updatedAt + 1);
    const next = { ...prev, ...changes, updatedAt } as Rec;
    const changed = MERGE.filter((field) => !Object.is(prev[field] ?? null, next[field] ?? null));
    if (changed.length === 0) return;
    const fields = widenToGroups(assetCollection, Object.fromEntries(changed.map((f) => [f, updatedAt])));
    device.local = next;
    device.outbox = { payload: next, fields: { ...device.outbox?.fields, ...fields } };
  }

  function pushOf(device: Device): Mutation | null {
    if (!device.outbox) return null;
    let record = device.outbox.payload;
    if (device.prePurge) {
      const { purgedAt: _p, ...rest } = record;
      record = rest as Rec;
    }
    return device.old ? { record } : { record, fields: device.outbox.fields };
  }

  function push(step: number, device: Device, { lostResponse = false } = {}) {
    const mutation = pushOf(device);
    if (!mutation) return;
    const result = serverPush(step, mutation);
    device.unanswered = lostResponse;
    if (lostResponse) return;
    if (result.status === 'skipped-lww') device.local = { ...result.current! };
    device.outbox = null;
  }

  function pull(device: Device) {
    if (server.seq <= device.cursor) return;
    device.cursor = server.seq;
    const incoming = server.record;
    const record = device.prePurge ? (({ purgedAt: _p, ...rest }) => rest as Rec)(incoming) : incoming;
    if (!device.outbox) {
      device.local = { ...device.local, ...record };
      return;
    }
    if (device.old) return; // main skips a record with a pending row
    const kept = Object.fromEntries(Object.keys(device.outbox.fields).map((f) => [f, device.local[f]]));
    device.local = {
      ...device.local,
      ...record,
      ...kept,
      updatedAt: Math.max(record.updatedAt, device.local.updatedAt),
    };
  }

  const ops = [
    'notes',
    'favorite',
    'flags',
    'kind',
    'delete',
    'restore',
    'purge',
    'push',
    'push',
    'lost',
    'pull',
    'pull',
    'sync',
  ] as const;
  for (let step = 0; step < steps; step++) {
    now += rand.pick([0, 1, 1, 2, 10, 50, 500]);
    if (rand.chance(0.02)) server.old = !server.old; // a rollback, and forward again
    const device = rand.pick(devices);
    const live = device.local.purgedAt == null;
    const op = rand.pick(ops);
    log?.push(
      `${step} t=${now - T0} ${device.name}${device.old ? '(old)' : ''}${server.old ? ' [old server]' : ''} ${op} local=${JSON.stringify({ u: device.local.updatedAt - T0, d: device.local.deletedAt && device.local.deletedAt - T0, p: device.local.purgedAt && device.local.purgedAt - T0 })} outbox=${JSON.stringify(device.outbox?.fields)}`,
    );
    switch (op) {
      case 'notes':
        if (live) write(device, { notes: rand.pick([null, 'x', 'y', `${device.name}${step}`]) });
        break;
      case 'favorite':
        if (live) write(device, { isFavorite: !device.local.isFavorite });
        break;
      case 'flags': {
        const on = rand.chance(0.5);
        if (live) write(device, { isFileSynced: on, isThumbnailSynced: on, isSynced: on && rand.chance(0.8) });
        break;
      }
      case 'kind':
        if (live) write(device, { mediaType: rand.pick(['photo', 'video']) });
        break;
      case 'delete':
        if (live && device.local.deletedAt == null)
          write(device, { deletedAt: Math.max(now + device.skew, device.local.updatedAt + 1) });
        break;
      case 'restore':
        if (live && device.local.deletedAt != null) write(device, { deletedAt: null });
        break;
      case 'purge':
        if (live && device.local.deletedAt != null && !device.prePurge) {
          const ts = Math.max(now + device.skew, device.local.updatedAt + 1);
          write(device, { purgedAt: ts });
        }
        break;
      case 'push':
        push(step, device);
        break;
      case 'lost':
        push(step, device, { lostResponse: true });
        break;
      case 'pull':
        if (device.unanswered) push(step, device);
        pull(device);
        break;
      case 'sync':
        push(step, device);
        pull(device);
        break;
    }
  }
  if (server.record.purgedAt != null) stats.purged++;

  // Quiet: the server rolls forward, every device syncs until nothing moves.
  server.old = false;
  now += 1_000_000;
  const frozenRow = server.record.purgedAt != null ? JSON.stringify(server.record) : null;
  for (let round = 0; round < 4; round++)
    for (const device of devices) {
      push(steps + round, device);
      pull(device);
    }
  if (frozenRow && JSON.stringify(server.record) !== frozenRow) fail(steps, 'the purged row changed while settling');

  for (const device of devices) {
    if (device.outbox) fail(steps, `${device.name} still has a pending row`);
    const local = synced(device.local);
    const expected = synced(server.record);
    if (device.prePurge) expected.purgedAt = local.purgedAt;
    if (JSON.stringify(local) !== JSON.stringify(expected))
      fail(steps, `${device.name} diverged: ${JSON.stringify(local)} vs ${JSON.stringify(expected)}`);
  }
  // Registers: the server holds the newest value that reached it (unless a purge froze the row first).
  if (server.record.purgedAt == null)
    for (const field of REGISTERS) {
      const best = server.oracle.get(field)!;
      if (!Object.is(server.record[field], best.value))
        fail(steps, `${field} is ${server.record[field]}, but the newest edit (${best.clock}) was ${best.value}`);
    }
  return violations;
}

describe('mergeRecord, property-style (seeded)', () => {
  it('3,000 random cases of three devices converge and keep every documented rule', () => {
    const violations: string[] = [];
    for (let seed = 1; seed <= 3000; seed++) violations.push(...runCase(seed, 60));
    expect(violations.slice(0, 10)).toEqual([]);
    // The cases exercise what they claim: purges that applied, and purges a restore beat.
    expect(stats.purged).toBeGreaterThan(300);
    expect(stats.restoredThenPurgeLost).toBeGreaterThan(30);
  });

  it('long cases (400 steps) converge too', () => {
    const violations: string[] = [];
    for (let seed = 10_001; seed <= 10_200; seed++) violations.push(...runCase(seed, 400));
    expect(violations.slice(0, 10)).toEqual([]);
  });
});

// A library merge (mergeLibrary) merges a device's pending edit into the account library's row
// against the account's pending clocks (0 for a field it hasn't edited), with a pending purge not
// final. Random inputs, seeded: a second pass of the same replay changes nothing, a deletion never
// replaces a pending purge, and only a newer restore undoes one.
describe('mergeRecord for a library merge, property-style (seeded)', () => {
  it('2,000 random replays: idempotent, and a pending purge yields to a newer restore only', () => {
    const problems: string[] = [];
    for (let seed = 1; seed <= 2000; seed++) {
      const rand = prng(seed);
      const value = () => rand.pick([null, 1000, 1500, 2000]);
      const deletedAt = value();
      const stored: Rec = {
        id: 'a',
        updatedAt: 3000,
        notes: rand.pick([null, 'x']),
        isFavorite: rand.chance(0.5),
        deletedAt,
        purgedAt: deletedAt !== null && rand.chance(0.5) ? 2500 : null,
      };
      const pendingFields = REGISTERS.concat(['deletedAt']).filter(() => rand.chance(0.3));
      const storedClocks = {
        ...Object.fromEntries(col.clockedFields.map((f) => [f, 0])),
        ...widenToGroups(assetCollection, Object.fromEntries(pendingFields.map((f) => [f, 1000 + rand.int(4) * 500]))),
      };
      const storedPurgeFinal = !('purgedAt' in storedClocks);
      const sentDeleted = value();
      const sent: Rec = {
        id: 'a',
        updatedAt: 4000,
        notes: rand.pick([null, 'y']),
        isFavorite: rand.chance(0.5),
        deletedAt: sentDeleted,
        purgedAt: sentDeleted !== null && rand.chance(0.4) ? 2800 : null,
      };
      const sentClocks = widenToGroups(
        assetCollection,
        Object.fromEntries(
          ['notes', 'isFavorite', 'deletedAt'].filter(() => rand.chance(0.6)).map((f) => [f, 1000 + rand.int(4) * 500]),
        ),
      );
      const input = { stored, storedClocks, sent, sentClocks, storedPurgeFinal };
      const first = mergeRecord(assetCollection, input);
      const fail = (message: string) => problems.push(`seed ${seed}: ${message} ${JSON.stringify(input)}`);
      // The second pass: the target row now holds the replay, its pending clocks the newer of the two.
      const clocks = { ...storedClocks };
      for (const field of first.applied)
        if (field in sentClocks) clocks[field] = Math.max(sentClocks[field]!, storedClocks[field] ?? 0);
      const second = mergeRecord(assetCollection, {
        ...input,
        stored: first.record,
        storedClocks: clocks,
        storedPurgeFinal: !('purgedAt' in clocks),
      });
      if (second.applied.length > 0) fail(`a second pass applied ${second.applied}`);
      const pendingPurgeBefore = stored.purgedAt != null && !storedPurgeFinal;
      if (pendingPurgeBefore && first.record.purgedAt == null) {
        const newerRestore = sent.deletedAt === null && sentClocks.deletedAt! > storedClocks.deletedAt!;
        if (!newerRestore) fail('a pending purge undone by something other than a newer restore');
      }
      if (pendingPurgeBefore && first.record.purgedAt != null && first.record.deletedAt !== stored.deletedAt)
        fail('a deletion replaced a pending purge’s deletedAt');
      if (stored.purgedAt != null && storedPurgeFinal && first.applied.length > 0) fail('a final purge took a field');
    }
    expect(problems.slice(0, 5)).toEqual([]);
  });
});

if (process.env.REPLAY) {
  const log: string[] = [];
  console.log(runCase(Number(process.env.REPLAY), Number(process.env.STEPS ?? 60), log).join('\n'));
  console.log(log.join('\n'));
}
