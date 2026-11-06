/**
 * Maps a Collab Connect backup (`app_data.json`) onto an account's contacts: what the one-time import
 * (import-collab-connect.ts) creates and changes. Pure, so it is tested without a database.
 *
 * - A Collab Connect contact keeps its id. One whose id the account already has was imported by an
 *   earlier run and is left alone, so running the import again changes nothing.
 * - Contacts are matched by X handle: one that matches an account contact, or an earlier Collab
 *   Connect contact, merges into it. The merge only fills what the contact lacks (notes, handles,
 *   phone, photo), adds the places it doesn't have and keeps a favorite a favorite.
 * - Lists are matched by name (ignoring case), so the account's list or an earlier list of the same
 *   name gets the members. The X profile Collab Connect cached (bio, X lists) is not imported.
 */
import { createHash } from 'node:crypto';
import {
  CONTACT_LIMITS,
  CONTACT_LIST_LIMITS,
  contactCollection,
  contactListCollection,
  contactListMemberCollection,
  normalizeHandle,
  z,
  type ContactListMemberRecord,
  type ContactListRecord,
  type ContactPlace,
  type ContactRecord,
  type FieldClocks,
} from '@squidbox/shared';

const optionalText = z.string().nullish();
const ccAddressSchema = z.object({ city: optionalText, state: optionalText, country: optionalText });
const ccContactSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  avatarFilename: optionalText,
  isFavorite: z.boolean().nullish(),
  note: optionalText,
  twitterHandle: optionalText,
  blueskyHandle: optionalText,
  ofHandle: optionalText,
  jffHandle: optionalText,
  phoneNumber: optionalText,
  addresses: z.array(ccAddressSchema).nullish(),
  twitterUser: z.object({ name: optionalText, username: optionalText }).nullish(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
const ccListSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  contactIds: z.array(z.string()).nullish(),
  createdAt: z.string().datetime(),
});
export const collabConnectBackupSchema = z.object({ contacts: z.array(ccContactSchema), lists: z.array(ccListSchema) });
export type CollabConnectBackup = z.infer<typeof collabConnectBackupSchema>;
type CcContact = CollabConnectBackup['contacts'][number];

export type AccountContacts = {
  contacts: ContactRecord[];
  lists: ContactListRecord[];
  members: ContactListMemberRecord[];
};

export type PlanOptions = {
  now: number;
  /** Whether the backup has the photo a contact's `avatarFilename` names. */
  hasAvatar: (filename: string) => boolean;
};

export type PlannedContact = {
  record: ContactRecord;
  /** The fields an existing contact gets; absent for a new contact, which is pushed whole. */
  fields?: FieldClocks;
  /** The Collab Connect photo to upload as `record.avatarFilename`. */
  avatarFrom?: string;
};

export type ImportPlan = {
  contacts: PlannedContact[];
  lists: ContactListRecord[];
  members: ContactListMemberRecord[];
  report: {
    alreadyImported: number;
    newContacts: number;
    /** A Collab Connect contact merged into another by X handle: its name and the contact's. */
    merged: { name: string; into: string; existing: boolean }[];
    /** Where both had notes that differ: the merged contact keeps its own. */
    notesKept: string[];
    missingAvatars: string[];
    /** Values cut to the limit, as `<contact>: <field>`. */
    cut: string[];
    mergedLists: string[];
    /** List memberships of contacts that are no longer in the backup. */
    unknownMembers: number;
  };
};

const TEXT_FIELDS = ['notes', 'xHandle', 'blueskyHandle', 'onlyFansHandle', 'jffHandle', 'phoneNumber'] as const;

export function planCollabConnectImport(
  backup: CollabConnectBackup,
  account: AccountContacts,
  { now, hasAvatar }: PlanOptions,
): ImportPlan {
  const report: ImportPlan['report'] = {
    alreadyImported: 0,
    newContacts: 0,
    merged: [],
    notesKept: [],
    missingAvatars: [],
    cut: [],
    mergedLists: [],
    unknownMembers: 0,
  };
  const cut = (owner: string, field: string, value: string, max: number) => {
    if (value.length <= max) return value;
    report.cut.push(`${owner}: ${field}`);
    return value.slice(0, max);
  };

  // ---- contacts
  const accountIds = new Set(account.contacts.map((contact) => contact.id));
  const planned = new Map<string, PlannedContact>();
  const byHandle = new Map<string, ContactRecord>();
  for (const contact of account.contacts)
    if (contact.deletedAt === null && contact.xHandle) byHandle.set(contact.xHandle, contact);
  // A Collab Connect id → the contact it is in the account (itself, or the one it merged into).
  const contactIdOf = new Map<string, string>();

  for (const cc of [...backup.contacts].sort(byCreatedAt)) {
    if (accountIds.has(cc.id)) {
      report.alreadyImported++;
      contactIdOf.set(cc.id, cc.id);
      continue;
    }
    const incoming = toContact(cc, now, cut);
    const avatarFrom = cc.avatarFilename && hasAvatar(cc.avatarFilename) ? cc.avatarFilename : undefined;
    if (cc.avatarFilename && !avatarFrom) report.missingAvatars.push(incoming.name);

    const match = incoming.xHandle ? byHandle.get(incoming.xHandle) : undefined;
    if (!match) {
      const entry: PlannedContact = {
        record: { ...incoming, avatarFilename: avatarFrom ? avatarName(incoming.id) : null },
        ...(avatarFrom && { avatarFrom }),
      };
      planned.set(incoming.id, entry);
      if (incoming.xHandle) byHandle.set(incoming.xHandle, entry.record);
      contactIdOf.set(cc.id, incoming.id);
      report.newContacts++;
      continue;
    }

    const isExisting = accountIds.has(match.id);
    const entry = planned.get(match.id) ?? { record: match, ...(isExisting && { fields: {} }) };
    const merged = { ...entry.record };
    const changed: string[] = [];
    for (const field of TEXT_FIELDS) {
      if (merged[field] === null && incoming[field] !== null) {
        merged[field] = incoming[field];
        changed.push(field);
      } else if (field === 'notes' && incoming.notes !== null && merged.notes !== incoming.notes) {
        report.notesKept.push(merged.name);
      }
    }
    const places = mergePlaces(merged.places, incoming.places);
    if (places.length !== merged.places.length) {
      merged.places = places;
      changed.push('places');
    }
    if (incoming.isFavorite && !merged.isFavorite) {
      merged.isFavorite = true;
      merged.favoritedAt = incoming.favoritedAt;
      changed.push('isFavorite', 'favoritedAt');
    }
    if (merged.avatarFilename === null && avatarFrom) {
      merged.avatarFilename = avatarName(merged.id);
      entry.avatarFrom = avatarFrom;
      changed.push('avatarFilename');
    }
    if (entry.fields) {
      merged.updatedAt = Math.max(now, merged.updatedAt);
      for (const field of changed) entry.fields[field] = merged.updatedAt;
    }
    entry.record = merged;
    if (changed.length > 0 || planned.has(match.id)) planned.set(match.id, entry);
    byHandle.set(incoming.xHandle!, merged);
    contactIdOf.set(cc.id, match.id);
    report.merged.push({ name: incoming.name, into: match.name, existing: isExisting });
  }

  // ---- lists
  const accountListIds = new Set(account.lists.map((list) => list.id));
  const listsByName = new Map<string, string>();
  for (const list of account.lists) if (list.deletedAt === null) listsByName.set(listKey(list.name), list.id);
  const plannedLists: ContactListRecord[] = [];
  const listFor = (id: string, name: string, createdAt: number): string => {
    if (accountListIds.has(id)) return id;
    const trimmed = name.trim() || 'Untitled list';
    const known = listsByName.get(listKey(trimmed));
    if (known) {
      report.mergedLists.push(trimmed);
      return known;
    }
    plannedLists.push(
      contactListCollection.schema.parse({
        id,
        createdAt,
        updatedAt: Math.max(now, createdAt),
        deletedAt: null,
        name: cut(`List ${trimmed}`, 'name', trimmed, CONTACT_LIST_LIMITS.name),
        notes: null,
      }),
    );
    listsByName.set(listKey(trimmed), id);
    return id;
  };

  const pairs: { listId: string; contactId: string }[] = [];
  for (const list of [...backup.lists].sort(byCreatedAt)) {
    const listId = listFor(list.id, list.name, Date.parse(list.createdAt));
    for (const ccId of list.contactIds ?? []) {
      const contactId = contactIdOf.get(ccId);
      if (contactId) pairs.push({ listId, contactId });
      else report.unknownMembers++;
    }
  }

  // ---- memberships: one per (list, contact); an edge the account has, even a removed one, stays as it is
  const seen = new Set(account.members.map((member) => `${member.listId}:${member.contactId}`));
  const members: ContactListMemberRecord[] = [];
  for (const { listId, contactId } of pairs) {
    const key = `${listId}:${contactId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    members.push(
      contactListMemberCollection.schema.parse({
        id: derivedId('member', listId, contactId),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        listId,
        contactId,
      }),
    );
  }

  const contacts = [...planned.values()].map((entry) => ({
    ...entry,
    record: contactCollection.schema.parse(entry.record),
  }));
  return { contacts, lists: plannedLists, members, report };
}

function toContact(
  cc: CcContact,
  now: number,
  cut: (owner: string, field: string, value: string, max: number) => string,
): ContactRecord {
  const xHandle = handle(cc.twitterHandle) ?? handle(cc.twitterUser?.username);
  const name = cc.name.trim() || cc.twitterUser?.name?.trim() || (xHandle ? `@${xHandle}` : 'Unnamed');
  const createdAt = Date.parse(cc.createdAt);
  const text = (field: string, value: string | null | undefined, max: number) => {
    const trimmed = value?.trim();
    return trimmed ? cut(name, field, trimmed, max) : null;
  };
  const places = mergePlaces(
    [],
    (cc.addresses ?? []).flatMap((address) => {
      const place = {
        city: text('place', address.city, CONTACT_LIMITS.place) ?? '',
        state: text('place', address.state, CONTACT_LIMITS.place) ?? '',
        country: text('place', address.country, CONTACT_LIMITS.place) ?? '',
      };
      return place.city || place.state || place.country ? [place] : [];
    }),
  );
  return {
    id: cc.id,
    createdAt,
    updatedAt: Math.max(now, createdAt),
    deletedAt: null,
    name: cut(name, 'name', name, CONTACT_LIMITS.name),
    isFavorite: cc.isFavorite === true,
    favoritedAt: cc.isFavorite === true ? Date.parse(cc.updatedAt) : null,
    notes: text('notes', cc.note, CONTACT_LIMITS.notes),
    xHandle: xHandle && cut(name, 'X handle', xHandle, CONTACT_LIMITS.handle),
    blueskyHandle: limitedHandle(cc.blueskyHandle, name, 'Bluesky handle', cut),
    onlyFansHandle: limitedHandle(cc.ofHandle, name, 'OnlyFans handle', cut),
    jffHandle: limitedHandle(cc.jffHandle, name, 'JFF handle', cut),
    phoneNumber: text('phone', cc.phoneNumber, CONTACT_LIMITS.phoneNumber),
    places,
    avatarFilename: null,
  };
}

function handle(value: string | null | undefined): string | null {
  return value ? normalizeHandle(value) || null : null;
}

function limitedHandle(
  value: string | null | undefined,
  owner: string,
  field: string,
  cut: (owner: string, field: string, value: string, max: number) => string,
): string | null {
  const normalized = handle(value);
  return normalized && cut(owner, field, normalized, CONTACT_LIMITS.handle);
}

// The places of both, each once (ignoring case), at most CONTACT_LIMITS.places.
function mergePlaces(places: ContactPlace[], more: ContactPlace[]): ContactPlace[] {
  const key = (place: ContactPlace) => [place.city, place.state, place.country].join('|').toLowerCase();
  const seen = new Set(places.map(key));
  const merged = [...places];
  for (const place of more)
    if (!seen.has(key(place)) && merged.length < CONTACT_LIMITS.places) {
      seen.add(key(place));
      merged.push(place);
    }
  return merged;
}

function avatarName(contactId: string): string {
  return `avatar-${contactId}-cc.jpg`;
}

function listKey(name: string): string {
  return name.trim().toLowerCase();
}

function byCreatedAt(a: { createdAt: string }, b: { createdAt: string }): number {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

// A UUID (version 5 layout) from the parts, so a record the import derives has the same id every run.
function derivedId(...parts: string[]): string {
  const hex = createHash('sha1').update(parts.join(':')).digest('hex');
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
