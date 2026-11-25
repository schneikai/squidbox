import { CHANNELS } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

import mentionChannels from '../src/features/post-mentions/mentionChannels';

const channel = (id: string) => CHANNELS.find((c) => c.id === id)!;
const ids = (ids: string[]) => mentionChannels(ids.map(channel)).map(({ id }) => id);

describe('mentionChannels', () => {
  it("lists only the user's channels, in their order", () => {
    expect(ids(['justforfans', 'x', 'onlyfans'])).toEqual(['justforfans', 'x', 'onlyfans']);
  });

  it('lists channels that share a handle once, as the one first in the catalog, where the first of them is', () => {
    expect(ids(['x', 'onlyfans-ppv', 'justforfans', 'onlyfans'])).toEqual(['x', 'onlyfans', 'justforfans']);
  });

  it('lists a channel that shares a handle under its own name when it is the only one of them', () => {
    expect(ids(['onlyfans-ppv'])).toEqual(['onlyfans-ppv']);
  });

  it('lists every handle of the catalog while the user has no channels', () => {
    expect(mentionChannels([]).map(({ id }) => id)).toEqual(['x', 'bluesky', 'instagram', 'onlyfans', 'justforfans']);
  });
});
