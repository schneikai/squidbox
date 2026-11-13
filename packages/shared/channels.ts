// The built-in channels a post can be on (Settings → Posts → Channels): a place plus a way of posting
// there, so OnlyFans (a post) and OnlyFans PPV (a pay-per-view message) are two. `id` is what a post's
// `channelId` and a `channels` record's `channelId` hold; `recordId` is the fixed id of the user's
// `channels` record for it, so two devices adding the same channel write one record and adding a
// deleted one again revives it. Both are stored data: never change them once shipped.
//
// The rules are the platform's published limits where one was found (the source beside each entry):
// `maxMedia` the media one post can hold, `maxTextLength` the limit of the field the post's text goes
// into (the post, the caption, the description or the body; never a title's), `hasThreads` whether
// posts can follow it in a thread. null: no limit known. The app warns over a limit and never blocks.

export type Channel = {
  id: string;
  recordId: string;
  name: string;
  maxMedia: number | null;
  maxTextLength: number | null;
  hasThreads: boolean;
};

export const CHANNELS = [
  // docs.x.com/fundamentals/counting-characters (280, the post's text);
  // help.x.com/en/using-x/how-to-post (up to 4 photos).
  {
    id: 'x',
    recordId: '4a418e44-693f-4848-8e6c-50b762248ebe',
    name: 'X',
    maxMedia: 4,
    maxTextLength: 280,
    hasThreads: true,
  },
  // @atproto/api lexicons: app.bsky.feed.post text maxGraphemes 300; app.bsky.embed.images maxLength 4.
  {
    id: 'bluesky',
    recordId: '2998365b-675e-490d-b22b-9617dc39c175',
    name: 'Bluesky',
    maxMedia: 4,
    maxTextLength: 300,
    hasThreads: true,
  },
  // developers.facebook.com/docs/threads/posts (500 characters; a carousel holds up to 20 items).
  {
    id: 'threads',
    recordId: '5ac9c244-3162-40f8-8abd-0ffb6880b963',
    name: 'Threads',
    maxMedia: 20,
    maxTextLength: 500,
    hasThreads: true,
  },
  // developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
  // (caption 2,200 characters; a carousel up to 20 images and videos).
  {
    id: 'instagram',
    recordId: '94b9fdc5-959c-4410-8f41-1ec636739c73',
    name: 'Instagram',
    maxMedia: 20,
    maxTextLength: 2200,
    hasThreads: false,
  },
  // developers.tiktok.com/doc/content-posting-api-reference-photo-post (description 4,000; up to 35 photos).
  {
    id: 'tiktok',
    recordId: 'f91bf5bb-9c41-403a-9948-62ac37f59ce8',
    name: 'TikTok',
    maxMedia: 35,
    maxTextLength: 4000,
    hasThreads: false,
  },
  // developers.google.com/youtube/v3/docs/videos (description 5,000 bytes; the title's 100 is not the
  // text's limit); one video per upload.
  {
    id: 'youtube',
    recordId: '67997e18-9fa5-4378-bf64-7f198ac1b27a',
    name: 'YouTube',
    maxMedia: 1,
    maxTextLength: 5000,
    hasThreads: false,
  },
  // A gallery holds up to 20 images (Reddit's gallery launch, July 2020, as reported); the body's
  // 40,000 is unverified (support.reddithelp.com not reachable); the title's 300 is not the text's limit.
  {
    id: 'reddit',
    recordId: 'e90c6d99-8de8-4c35-96ad-e2f929bc258d',
    name: 'Reddit',
    maxMedia: 20,
    maxTextLength: 40000,
    hasThreads: false,
  },
  // No published limits found.
  {
    id: 'patreon',
    recordId: '5152f97c-6e1f-4c8b-a1ad-3332b67ec9fa',
    name: 'Patreon',
    maxMedia: null,
    maxTextLength: null,
    hasThreads: false,
  },
  // The design's example values, unverified (no published limits found).
  {
    id: 'onlyfans',
    recordId: '513bced9-6176-4876-8b34-76d3fba361fc',
    name: 'OnlyFans',
    maxMedia: 20,
    maxTextLength: 1000,
    hasThreads: false,
  },
  // The design's example values, unverified (no published limits found).
  {
    id: 'onlyfans-ppv',
    recordId: '675abb2a-2693-4d8c-86df-de3b5251bec2',
    name: 'OnlyFans PPV',
    maxMedia: 20,
    maxTextLength: 1000,
    hasThreads: false,
  },
] as const satisfies readonly Channel[];

export type ChannelId = (typeof CHANNELS)[number]['id'];

const byId = new Map<string, Channel>(CHANNELS.map((channel) => [channel.id, channel]));

/** The catalog's channel of `id`; undefined for none and for an id this build doesn't know (skip it). */
export function channelById(id: string | null | undefined): Channel | undefined {
  return id ? byId.get(id) : undefined;
}
