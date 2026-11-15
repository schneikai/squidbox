import type { ContactHandleField } from './collections/contact';

// The built-in channels a post can be sent to (Settings → Posts → Channels). `id` is what a `channels`
// record's and a `post_copies` record's `channelId` hold; `recordId` is the fixed id of the user's
// `channels` record for it, so two devices adding the same channel write one record and adding a
// deleted one again revives it. Both are stored data: never change them once shipped.
//
// The rules are the platform's published limits where one was found (the source beside each entry):
// `maxMedia` the media one post can hold, `maxTextLength` the limit of the field the post's text goes
// into (the post, the caption, the description or the body; never a title's), `hasThreads` whether
// posts can follow it in a thread. null: no limit known. The app warns over a limit and never blocks.
// `handleField` is the contact's handle a mention goes out as on the channel (CONTACT_HANDLES).

export type Channel = {
  id: string;
  recordId: string;
  name: string;
  maxMedia: number | null;
  maxTextLength: number | null;
  hasThreads: boolean;
  handleField: ContactHandleField;
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
    handleField: 'xHandle',
  },
  // @atproto/api lexicons: app.bsky.feed.post text maxGraphemes 300; app.bsky.embed.images maxLength 4.
  {
    id: 'bluesky',
    recordId: '2998365b-675e-490d-b22b-9617dc39c175',
    name: 'Bluesky',
    maxMedia: 4,
    maxTextLength: 300,
    hasThreads: true,
    handleField: 'blueskyHandle',
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
    handleField: 'instagramHandle',
  },
  // The design's example values, unverified (no published limits found).
  {
    id: 'onlyfans',
    recordId: '513bced9-6176-4876-8b34-76d3fba361fc',
    name: 'OnlyFans',
    maxMedia: 20,
    maxTextLength: 1000,
    hasThreads: false,
    handleField: 'onlyFansHandle',
  },
  // No published limits (its help desk, fanshelp.freshdesk.com, names only the 10 GB upload size); a
  // post stands alone, with no thread.
  {
    id: 'justforfans',
    recordId: 'a80141a1-3da9-433e-8e2d-430125fb330e',
    name: 'JustFor.Fans',
    maxMedia: null,
    maxTextLength: null,
    hasThreads: false,
    handleField: 'jffHandle',
  },
] as const satisfies readonly Channel[];

export type ChannelId = (typeof CHANNELS)[number]['id'];

const byId = new Map<string, Channel>(CHANNELS.map((channel) => [channel.id, channel]));

/** The catalog's channel of `id`; undefined for none and for an id this build doesn't know (skip it). */
export function channelById(id: string | null | undefined): Channel | undefined {
  return id ? byId.get(id) : undefined;
}

/** A channel's name as the app shows it: the catalog's, the id of one this build doesn't know, or No channel. */
export function channelName(channelId: string | null): string {
  if (!channelId) return 'No channel';
  return channelById(channelId)?.name ?? channelId;
}
