import type { ChatSubjectKind, IdeasKind } from '@squidbox/shared';
import { useMemo, useReducer, useState } from 'react';

import PostCards from './PostCards';
import cardsReducer from './draft/cardsReducer';
import draftFromPost, { type PostEditorPost } from './draft/draftFromPost';
import hasCardContent from './draft/hasCardContent';
import postData, { type EditedPost } from './draft/postData';
import postedAtToSave, { type PickedPostedAt } from './postedAtToSave';

import EditSheet from '@/components/EditSheet';
import useEditSheet from '@/hooks/useEditSheet';
import changedValues from '@/utils/changedValues';
import getTimestamp from '@/utils/date-time/getTimestamp';
import isPresent from '@/utils/isPresent';

type PostEditorProps = {
  kind: Extract<ChatSubjectKind, 'draft' | 'edit'>;
  ideas: IdeasKind;
  post: PostEditorPost;
  onSave: (post: EditedPost, seed: EditedPost) => Promise<unknown>;
};

// Edits a post and its thread, seeded once from `post` ({ text, postAssets, postedAt, threadPosts })
// into its cards (cardsReducer), as a draft sheet of PostCards. Add (a new post, `kind` 'draft') or
// Save (an edit) hands `onSave` the post the posts store takes (postData), allowed once every post
// has text or a photo (and, for Save, something changed), and the seed in the same shape, so an edit
// can save only what changed; a save that throws says so and keeps the editor open. A new post that
// opens empty has the cursor in its text, keyboard up. × or a swipe down with changes asks first.
// `kind` is also what the assistant's chat about the cards is about ('draft' a new post, 'edit' a
// saved one), and `ideas` which ideas the first card's tray offers, started on their own for a new post.
export default function PostEditor({ kind, ideas, post, onSave }: PostEditorProps) {
  const [draft, dispatch] = useReducer(cardsReducer, post, draftFromPost);
  // The Posted time the user picked: undefined while untouched, null once removed (postedAtToSave).
  const [pickedPostedAt, setPickedPostedAt] = useState<PickedPostedAt>(undefined);
  const isNew = kind === 'draft';
  // A new post that opens empty (New post's card) is there to be written: its text takes the cursor.
  const [isOpenedEmpty] = useState(() => isNew && !hasCardContent(post));
  const seed = useMemo(() => postData(draftFromPost(post), post.postedAt), [post]);
  const postedAt = pickedPostedAt === undefined ? post.postedAt : pickedPostedAt;
  // A new post's time is now until the user picks one, and a removed one is none: till then the
  // toolbar shows only its clock.
  const isPostedAtShown = postedAt != null && (kind === 'edit' || pickedPostedAt !== undefined);
  const data = postData(draft, postedAt);

  // The posts store syncs by itself. The save resolves an untouched Posted time (postedAtToSave): a
  // new post's is the time of the save.
  const { sheetProps } = useEditSheet({
    isNew,
    isValid: draft.cards.every(hasCardContent),
    isDirty: isPresent(changedValues(seed, data)),
    save: () => {
      const savedAt = postedAtToSave({
        isNew,
        picked: pickedPostedAt,
        seedPostedAt: seed.postedAt,
        now: getTimestamp(),
      });
      return onSave({ ...data, postedAt: savedAt }, seed);
    },
    syncsItself: true,
  });

  return (
    <EditSheet testID="post-editor" {...sheetProps}>
      <PostCards
        draft={draft}
        dispatch={dispatch}
        kind={kind}
        ideas={ideas}
        startsOnItsOwn
        autoFocusFirst={isOpenedEmpty}
        postedAt={postedAt}
        isPostedAtShown={isPostedAtShown}
        onChangePostedAt={setPickedPostedAt}
      />
    </EditSheet>
  );
}
