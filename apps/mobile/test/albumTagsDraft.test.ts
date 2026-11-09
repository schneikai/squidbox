import { ASSET_TAG_LIMITS } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

import albumTagsDraft, { type AlbumTagsPhoto } from '../src/features/album-tags/albumTagsDraft';

const photos = (...tags: (string[] | null)[]): AlbumTagsPhoto[] => tags.map((each, i) => ({ id: `p${i}`, tags: each }));
const many = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe('albumTagsDraft', () => {
  it('shows a tag on all photos solid and one on some dashed, a never-tagged photo having none', () => {
    const draft = albumTagsDraft.start(photos(['granite', 'fog'], ['granite'], null));
    expect(albumTagsDraft.tags(draft)).toEqual(['granite', 'fog']);
    expect(albumTagsDraft.mixedTags(draft)).toEqual(['granite', 'fog']);
    expect(albumTagsDraft.mixedTags(albumTagsDraft.start(photos(['granite', 'fog'], ['granite'])))).toEqual(['fog']);
  });

  it('groups tags in any case under the first spelling', () => {
    const draft = albumTagsDraft.start(photos(['Hiking'], [' hiking ']));
    expect(albumTagsDraft.tags(draft)).toEqual(['Hiking']);
    expect(albumTagsDraft.mixedTags(draft)).toEqual([]);
  });

  it('orders the tags on the most photos first, then by first appearance', () => {
    const draft = albumTagsDraft.start(photos(['moss', 'fog'], ['creek', 'fog'], ['lake', 'creek', 'fog']));
    expect(albumTagsDraft.tags(draft)).toEqual(['fog', 'creek', 'moss', 'lake']);
  });

  it('puts a dashed tag on all photos where it is', () => {
    const draft = albumTagsDraft.putOnAll(albumTagsDraft.start(photos(['fog', 'moss'], ['fog'])), 'moss')!;
    expect(albumTagsDraft.tags(draft)).toEqual(['fog', 'moss']);
    expect(albumTagsDraft.mixedTags(draft)).toEqual([]);
    expect(albumTagsDraft.edit(draft)).toEqual({ add: ['moss'], remove: [] });
  });

  it('takes a tag taken out of the list off all photos', () => {
    const draft = albumTagsDraft.change(albumTagsDraft.start(photos(['fog', 'moss'], ['fog'])), ['fog']);
    expect(albumTagsDraft.edit(draft)).toEqual({ add: [], remove: ['moss'] });
  });

  it("puts a dashed tag typed again (TagsField's mixed press) on all photos", () => {
    const start = albumTagsDraft.start(photos(['fog', 'moss'], ['fog']));
    // TagsField drops the duplicate from its list and calls mixed.onPress with the chip's tag.
    expect(albumTagsDraft.change(start, ['fog', 'moss'])).toEqual(start);
    expect(albumTagsDraft.mixedTags(albumTagsDraft.putOnAll(start, 'MOSS')!)).toEqual([]);
  });

  it('puts a new tag on all photos, at the end', () => {
    const draft = albumTagsDraft.change(albumTagsDraft.start(photos(['fog'], ['moss'])), ['fog', 'moss', 'granite']);
    expect(albumTagsDraft.tags(draft)).toEqual(['fog', 'moss', 'granite']);
    expect(albumTagsDraft.mixedTags(draft)).toEqual(['fog', 'moss']);
    expect(albumTagsDraft.edit(draft)).toEqual({ add: ['granite'], remove: [] });
  });

  it('is clean again once a tag on all photos is taken out and added back', () => {
    const start = albumTagsDraft.start(photos(['fog'], ['fog']));
    const removed = albumTagsDraft.change(start, []);
    expect(albumTagsDraft.isDirty(removed)).toBe(true);
    expect(albumTagsDraft.isDirty(albumTagsDraft.change(removed, ['fog']))).toBe(false);
  });

  it("adds Tag it's tags on all photos: keeps those on all, puts dashed ones on all, adds new ones", () => {
    const draft = albumTagsDraft.addOnAll(albumTagsDraft.start(photos(['fog', 'moss'], ['fog'])), [
      'Fog',
      'moss',
      'granite',
      'granite',
    ]);
    expect(albumTagsDraft.tags(draft)).toEqual(['fog', 'moss', 'granite']);
    expect(albumTagsDraft.mixedTags(draft)).toEqual([]);
    expect(albumTagsDraft.edit(draft)).toEqual({ add: ['moss', 'granite'], remove: [] });
  });

  it('puts a tag on all photos only while every photo has room for it', () => {
    const full = many('t', ASSET_TAG_LIMITS.tags - 1);
    const start = albumTagsDraft.start(photos([...full, 'fog'], ['moss']));
    expect(albumTagsDraft.room(start)).toBe(0);
    expect(albumTagsDraft.putOnAll(start, 'moss')).toBeNull();
    expect(albumTagsDraft.tags(albumTagsDraft.change(start, [...albumTagsDraft.tags(start), 'granite']))).toEqual(
      albumTagsDraft.tags(start),
    );
    const freed = albumTagsDraft.change(
      start,
      albumTagsDraft.tags(start).filter((tag) => tag !== 't0' && tag !== 't1'),
    );
    expect(albumTagsDraft.room(freed)).toBe(2);
    expect(albumTagsDraft.mixedTags(albumTagsDraft.putOnAll(freed, 'moss')!)).not.toContain('moss');
    expect(albumTagsDraft.edit(albumTagsDraft.addOnAll(freed, ['a', 'b', 'c'])).add).toEqual(['a', 'b']);
  });
});
