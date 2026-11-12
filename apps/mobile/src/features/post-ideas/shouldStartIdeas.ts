import type { ChatSubjectKind, IdeasKind } from '@squidbox/shared';

type StartIdeasState = {
  // What the editor is about: only a new post's ('draft') ideas start on their own.
  kind: ChatSubjectKind;
  ideas: IdeasKind;
  // The kind's switch (Settings → Assistant), undefined while reading.
  isOn: boolean | undefined;
  // Whether the first post has media.
  hasMedia: boolean;
  // Whether this editor started them already: once per sheet.
  hasStarted: boolean;
  isAvailable: boolean;
  // Before the library's first sync is done, a switch the user turned off on another device reads
  // as on.
  isFirstSyncDone: boolean;
};

/**
 * Whether the editor starts its ideas now, once per sheet: a new post's Post ideas once its first
 * post has media, a repost's Repost ideas as it opens; only while that kind's switch is on, the
 * assistant available and the first sync done. Editing a saved post never starts them, nor does a
 * post of the thread.
 */
export default function shouldStartIdeas({
  kind,
  ideas,
  isOn,
  hasMedia,
  hasStarted,
  isAvailable,
  isFirstSyncDone,
}: StartIdeasState): boolean {
  return (
    kind === 'draft' &&
    !hasStarted &&
    isAvailable &&
    isFirstSyncDone &&
    isOn === true &&
    (ideas === 'repost' || hasMedia)
  );
}
