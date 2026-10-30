import { describe, expect, it } from 'vitest';

import missingPlaceholdersNote from '../src/features/instructions/missingPlaceholdersNote';

describe('missingPlaceholdersNote', () => {
  it('names the placeholders a text lacks', () => {
    expect(missingPlaceholdersNote('visionTagging', 'Tag this photo.')).toBe(
      "This text has no {themes}, so the assistant won't get it.",
    );
    const writing = 'Write {count} posts. {aboutYou} {tone} {contentTags} {rules} {posts} {media} {tags}';
    expect(missingPlaceholdersNote('writing', writing)).toBe(
      "This text has no {mentions} or {caption}, so the assistant won't get them.",
    );
  });

  it('is null while the text has them all', () => {
    expect(missingPlaceholdersNote('visionTagging', 'Themes: {themes}')).toBeNull();
    expect(missingPlaceholdersNote('moreLikeThis', 'More like this.')).toBeNull();
  });
});
