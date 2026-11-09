import { ASSET_TAG_LIMITS } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

import {
  addOnAll,
  changeTags,
  draftEdit,
  draftTags,
  isDirty,
  mixedTags,
  putOnAll,
  room,
  startAlbumTags,
  type AlbumTagsPhoto,
} from '../src/features/album-tags/albumTagsDraft';

const photos = (...tags: (string[] | null)[]): AlbumTagsPhoto[] => tags.map((each, i) => ({ id: `p${i}`, tags: each }));
const many = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe('albumTagsDraft', () => {
  it('shows a tag on all photos solid and one on some dashed, a never-tagged photo having none', () => {
    const draft = startAlbumTags(photos(['granite', 'fog'], ['granite'], null));
    expect(draftTags(draft)).toEqual(['granite', 'fog']);
    expect(mixedTags(draft)).toEqual(['granite', 'fog']);
    expect(mixedTags(startAlbumTags(photos(['granite', 'fog'], ['granite'])))).toEqual(['fog']);
  });

  it('groups tags in any case under the first spelling', () => {
    const draft = startAlbumTags(photos(['Hiking'], [' hiking ']));
    expect(draftTags(draft)).toEqual(['Hiking']);
    expect(mixedTags(draft)).toEqual([]);
  });

  it('orders the tags on the most photos first, then by first appearance', () => {
    const draft = startAlbumTags(photos(['moss', 'fog'], ['creek', 'fog'], ['lake', 'creek', 'fog']));
    expect(draftTags(draft)).toEqual(['fog', 'creek', 'moss', 'lake']);
  });

  it('puts a dashed tag on all photos where it is', () => {
    const draft = putOnAll(startAlbumTags(photos(['fog', 'moss'], ['fog'])), 'moss')!;
    expect(draftTags(draft)).toEqual(['fog', 'moss']);
    expect(mixedTags(draft)).toEqual([]);
    expect(draftEdit(draft)).toEqual({ add: ['moss'], remove: [] });
  });

  it('takes a tag taken out of the list off all photos', () => {
    const draft = changeTags(startAlbumTags(photos(['fog', 'moss'], ['fog'])), ['fog']);
    expect(draftEdit(draft)).toEqual({ add: [], remove: ['moss'] });
  });

  it("puts a dashed tag typed again (TagsField's mixed press) on all photos", () => {
    const start = startAlbumTags(photos(['fog', 'moss'], ['fog']));
    // TagsField drops the duplicate from its list and calls mixed.onPress with the chip's tag.
    expect(changeTags(start, ['fog', 'moss'])).toEqual(start);
    expect(mixedTags(putOnAll(start, 'MOSS')!)).toEqual([]);
  });

  it('puts a new tag on all photos, at the end', () => {
    const draft = changeTags(startAlbumTags(photos(['fog'], ['moss'])), ['fog', 'moss', 'granite']);
    expect(draftTags(draft)).toEqual(['fog', 'moss', 'granite']);
    expect(mixedTags(draft)).toEqual(['fog', 'moss']);
    expect(draftEdit(draft)).toEqual({ add: ['granite'], remove: [] });
  });

  it('is clean again once a tag on all photos is taken out and added back', () => {
    const start = startAlbumTags(photos(['fog'], ['fog']));
    const removed = changeTags(start, []);
    expect(isDirty(removed)).toBe(true);
    expect(isDirty(changeTags(removed, ['fog']))).toBe(false);
  });

  it("adds Tag it's tags on all photos: keeps those on all, puts dashed ones on all, adds new ones", () => {
    const draft = addOnAll(startAlbumTags(photos(['fog', 'moss'], ['fog'])), ['Fog', 'moss', 'granite', 'granite']);
    expect(draftTags(draft)).toEqual(['fog', 'moss', 'granite']);
    expect(mixedTags(draft)).toEqual([]);
    expect(draftEdit(draft)).toEqual({ add: ['moss', 'granite'], remove: [] });
  });

  it('puts a tag on all photos only while every photo has room for it', () => {
    const full = many('t', ASSET_TAG_LIMITS.tags - 1);
    const start = startAlbumTags(photos([...full, 'fog'], ['moss']));
    expect(room(start)).toBe(0);
    expect(putOnAll(start, 'moss')).toBeNull();
    expect(draftTags(changeTags(start, [...draftTags(start), 'granite']))).toEqual(draftTags(start));
    const freed = changeTags(
      start,
      draftTags(start).filter((tag) => tag !== 't0' && tag !== 't1'),
    );
    expect(room(freed)).toBe(2);
    expect(mixedTags(putOnAll(freed, 'moss')!)).not.toContain('moss');
    expect(draftEdit(addOnAll(freed, ['a', 'b', 'c'])).add).toEqual(['a', 'b']);
  });
});
