import { describe, expect, it } from 'vitest';

import markedText from '../src/features/post-mentions/markedText';

describe('markedText', () => {
  it('leaves a name two contacts of the Mentions share as plain text, also when it differs only in case', () => {
    const sams = [
      { id: 's1', name: 'Sam Ridge' },
      { id: 's2', name: 'sam ridge' },
    ];
    expect(markedText.read('With @[Sam Ridge]', sams)).toEqual({ text: 'With Sam Ridge', mentions: null });
  });

  it("gives a name a draft chip carries that chip's contact, though a Mentions contact shares it", () => {
    const mentioned = [
      { id: 'mentions', name: 'Sam Ridge' },
      { id: 'chip', name: 'Sam Ridge', isInDraft: true },
    ];
    expect(markedText.read('With @[Sam Ridge]', mentioned).mentions).toEqual([
      { contactId: 'chip', location: 5, name: 'Sam Ridge' },
    ]);
  });
});
