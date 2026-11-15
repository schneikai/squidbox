import { describe, expect, it } from 'vitest';

import keptChips from '../src/features/post-mentions/keptChips';

const MAYA = { text: 'With Maya', mentions: [{ contactId: 'maya', location: 5, name: 'Maya' }] };
const plain = (text: string) => ({ text, mentions: null });

describe('keptChips', () => {
  it('drops a chip whose name the new text holds twice, after an @ or #, or in a handle, an address or a longer word', () => {
    for (const text of [
      'Maya and Maya',
      'With @Maya',
      'Hiking #Maya',
      'With @Maya.bsky.social',
      'Mail Maya@x.com',
      'Mayan ruins',
    ]) {
      expect(keptChips(MAYA, plain(text)).mentions).toBeNull();
    }
  });
});
