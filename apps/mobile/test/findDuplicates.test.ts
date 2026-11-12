import { describe, it, expect } from 'vitest';

import duplicateCandidates from '../src/features/contact-new/duplicateCandidates';
import findDuplicatesIn, { type DuplicateMatch } from '../src/features/contact-new/findDuplicates';

const fields = (over: Record<string, string | null>) => ({
  name: '',
  xHandle: null,
  blueskyHandle: null,
  onlyFansHandle: null,
  jffHandle: null,
  instagramHandle: null,
  ...over,
});
const findDuplicates = (typed: Parameters<typeof findDuplicatesIn>[0], contacts: DuplicateMatch['contact'][]) =>
  findDuplicatesIn(typed, duplicateCandidates(contacts));
const maya: DuplicateMatch['contact'] = {
  id: 'maya',
  name: 'Maya Lindqvist',
  xHandle: 'mayal',
  blueskyHandle: 'maya.bsky.social',
  onlyFansHandle: null,
  jffHandle: null,
  instagramHandle: null,
  avatarFilename: null,
};

describe('findDuplicates', () => {
  it('names the same name and X handle together', () => {
    const { matches, sharedFields } = findDuplicates(fields({ name: 'maya lindqvist', xHandle: 'mayal' }), [maya]);
    expect(matches.map((match) => match.reason)).toEqual(['Same name and X handle']);
    expect([...sharedFields].sort()).toEqual(['name', 'xHandle']);
  });

  it('finds a shared Bluesky handle under another name', () => {
    const { matches } = findDuplicates(fields({ name: 'Maya L', blueskyHandle: 'maya.bsky.social' }), [maya]);
    expect(matches.map((match) => match.reason)).toEqual(['Same Bluesky handle']);
  });

  it('finds the same handle under another spelling', () => {
    for (const xHandle of ['@MayaL', 'https://x.com/mayal'])
      expect(findDuplicates(fields({ xHandle }), [maya]).matches.map((match) => match.reason)).toEqual([
        'Same X handle',
      ]);
    const i = { ...maya, xHandle: 'i', blueskyHandle: null };
    expect(findDuplicates(fields({ xHandle: 'https://x.com/i/lists/1' }), [i]).matches).toEqual([]);
  });

  it('a same name alone is no duplicate', () => {
    expect(findDuplicates(fields({ name: 'Maya Lindqvist' }), [maya]).matches).toEqual([]);
  });
});
