import { describe, expect, it } from 'vitest';
import type { ContactRecord } from '@squidbox/shared';
import { planCollabConnectImport, type CollabConnectBackup } from '../scripts/collabConnectPlan.js';

const NOW = Date.parse('2026-11-06T12:00:00Z');
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const options = { now: NOW, hasAvatar: () => true };
const empty = { contacts: [], lists: [], members: [] };

function ccContact(n: number, fields: Partial<CollabConnectBackup['contacts'][number]> = {}) {
  return {
    id: ID(n),
    name: `Contact ${n}`,
    createdAt: `2024-07-0${n}T10:00:00.000Z`,
    updatedAt: '2024-08-01T10:00:00.000Z',
    ...fields,
  };
}

function accountContact(n: number, fields: Partial<ContactRecord> = {}): ContactRecord {
  return {
    id: ID(100 + n),
    createdAt: NOW - 1000,
    updatedAt: NOW - 1000,
    deletedAt: null,
    name: `Squidbox ${n}`,
    isFavorite: false,
    favoritedAt: null,
    notes: null,
    xHandle: null,
    blueskyHandle: null,
    onlyFansHandle: null,
    jffHandle: null,
    phoneNumber: null,
    places: [],
    avatarFilename: null,
    ...fields,
  };
}

describe('planCollabConnectImport', () => {
  it('maps a contact with its id, handles as the app stores them and places without coordinates', () => {
    const backup = {
      contacts: [
        ccContact(1, {
          name: ' Maya ',
          isFavorite: true,
          note: 'Met at the print fair',
          twitterHandle: '@MayaL',
          ofHandle: 'https://onlyfans.com/MayaL',
          jffHandle: '@MayaJ',
          phoneNumber: '+47 123',
          avatarFilename: `${ID(1)}.jpg`,
          addresses: [
            { city: 'Tromsø', state: null, country: 'Norway', latitude: 69.6, longitude: 18.9 },
            { city: '', country: null },
          ] as never,
        }),
      ],
      lists: [],
    };
    const { contacts } = planCollabConnectImport(backup, empty, options);
    expect(contacts).toEqual([
      {
        avatarFrom: `${ID(1)}.jpg`,
        record: {
          id: ID(1),
          createdAt: Date.parse('2024-07-01T10:00:00.000Z'),
          updatedAt: NOW,
          deletedAt: null,
          name: 'Maya',
          isFavorite: true,
          favoritedAt: Date.parse('2024-08-01T10:00:00.000Z'),
          notes: 'Met at the print fair',
          xHandle: 'mayal',
          blueskyHandle: null,
          onlyFansHandle: 'mayal',
          jffHandle: 'mayaj',
          phoneNumber: '+47 123',
          places: [{ city: 'Tromsø', state: '', country: 'Norway' }],
          avatarFilename: `avatar-${ID(1)}-cc.jpg`,
        },
      },
    ]);
  });

  it('changes nothing for contacts, lists and memberships an earlier run imported', () => {
    const backup = {
      contacts: [ccContact(1, { twitterHandle: '@a' }), ccContact(2)],
      lists: [{ id: ID(50), name: 'Paris', contactIds: [ID(1), ID(2)], createdAt: '2024-07-01T10:00:00.000Z' }],
    };
    const first = planCollabConnectImport(backup, empty, options);
    const again = planCollabConnectImport(
      backup,
      { contacts: first.contacts.map((c) => c.record), lists: first.lists, members: first.members },
      options,
    );
    expect(again.contacts).toEqual([]);
    expect(again.lists).toEqual([]);
    expect(again.members).toEqual([]);
    expect(again.report.alreadyImported).toBe(2);
  });

  it('merges into the account contact with the same X handle, filling only what it lacks', () => {
    const existing = accountContact(1, {
      xHandle: 'mayal',
      notes: 'Own notes',
      places: [{ city: 'Oslo', state: '', country: 'Norway' }],
    });
    const backup = {
      contacts: [
        ccContact(1, {
          twitterHandle: '@MayaL',
          note: 'Old notes',
          phoneNumber: '+47 123',
          avatarFilename: 'a.jpg',
          addresses: [{ city: 'Tromsø', country: 'Norway' }],
        }),
      ],
      lists: [],
    };
    const { contacts, report } = planCollabConnectImport(backup, { ...empty, contacts: [existing] }, options);
    expect(contacts).toEqual([
      {
        avatarFrom: 'a.jpg',
        fields: { phoneNumber: NOW, places: NOW, avatarFilename: NOW },
        record: {
          ...existing,
          updatedAt: NOW,
          phoneNumber: '+47 123',
          places: [...existing.places, { city: 'Tromsø', state: '', country: 'Norway' }],
          avatarFilename: `avatar-${existing.id}-cc.jpg`,
        },
      },
    ]);
    expect(report.notesKept).toEqual(['Squidbox 1']);
  });

  it('merges Collab Connect contacts with the same X handle into the one added first', () => {
    const backup = {
      contacts: [
        ccContact(2, { twitterHandle: '@Sam', phoneNumber: '+1 555' }),
        ccContact(1, { twitterHandle: 'sam' }),
      ],
      lists: [{ id: ID(50), name: 'LA', contactIds: [ID(1), ID(2)], createdAt: '2024-07-01T10:00:00.000Z' }],
    };
    const { contacts, members } = planCollabConnectImport(backup, empty, options);
    expect(contacts.map(({ record }) => [record.id, record.phoneNumber])).toEqual([[ID(1), '+1 555']]);
    expect(members.map(({ contactId }) => contactId)).toEqual([ID(1)]);
  });

  it('merges lists of the same name and skips members that are gone or already in the list', () => {
    const squidboxList = { id: ID(60), createdAt: NOW, updatedAt: NOW, deletedAt: null, name: 'Have met', notes: null };
    const backup = {
      contacts: [ccContact(1), ccContact(2)],
      lists: [
        { id: ID(50), name: 'Mexico', contactIds: [ID(1), ID(99)], createdAt: '2024-07-01T10:00:00.000Z' },
        { id: ID(51), name: 'Mexico ', contactIds: [ID(1), ID(2)], createdAt: '2024-07-02T10:00:00.000Z' },
        { id: ID(52), name: 'Have Met', contactIds: [ID(2)], createdAt: '2024-07-03T10:00:00.000Z' },
      ],
    };
    const { lists, members, report } = planCollabConnectImport(backup, { ...empty, lists: [squidboxList] }, options);
    expect(lists.map(({ id, name }) => [id, name])).toEqual([[ID(50), 'Mexico']]);
    expect(members.map(({ listId, contactId }) => [listId, contactId])).toEqual([
      [ID(50), ID(1)],
      [ID(50), ID(2)],
      [ID(60), ID(2)],
    ]);
    expect(report.unknownMembers).toBe(1);
  });

  it('leaves a contact without a photo when the backup lacks its file', () => {
    const backup = { contacts: [ccContact(1, { avatarFilename: 'gone.jpg' })], lists: [] };
    const { contacts, report } = planCollabConnectImport(backup, empty, { now: NOW, hasAvatar: () => false });
    expect(contacts[0]!.record.avatarFilename).toBeNull();
    expect(contacts[0]!.avatarFrom).toBeUndefined();
    expect(report.missingAvatars).toEqual(['Contact 1']);
  });
});
