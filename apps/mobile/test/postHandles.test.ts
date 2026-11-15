import { describe, expect, it } from 'vitest';

import postHandles from '../src/features/post-mentions/postHandles';

describe('postHandles', () => {
  it("lists a post's typed handles and every handle of its chips' live contacts, not a deleted one's", () => {
    const contacts = new Map([
      ['maya', { id: 'maya', name: 'Maya', xHandle: 'maya_x', blueskyHandle: 'maya.bsky.social' }],
    ]);
    const posts = [
      {
        text: 'Maya with @trailjo and Gone',
        mentions: [
          { contactId: 'maya', location: 0, name: 'Maya' },
          { contactId: 'deleted', location: 23, name: 'Gone' },
        ],
      },
    ];
    expect(postHandles(posts, contacts).sort()).toEqual(['@maya.bsky.social', '@maya_x', '@trailjo']);
  });
});
