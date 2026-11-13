import type { ChatSubjectKind, IdeasKind } from '@squidbox/shared';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import OtherChannels from './OtherChannels';
import PostCards from './PostCards';
import channelStepPath from './channelStepPath';
import type { ChannelDraftAction } from './draft/channelDraftReducer';
import draftFromPost from './draft/draftFromPost';
import firstUnusedChannelId from './draft/firstUnusedChannelId';
import hasCardContent from './draft/hasCardContent';
import postData from './draft/postData';
import type { EditedPost, PostEditorPost } from './draft/postDraftReducer';
import usePostDraft from './draft/usePostDraft';
import usedChannelIds from './draft/usedChannelIds';
import postedAtToSave from './postedAtToSave';

import EditSheet from '@/components/EditSheet';
import useChannelOrder from '@/features/channels/useChannelOrder';
import useChannels from '@/features/channels/useChannels';
import useEditSheet from '@/hooks/useEditSheet';
import changedValues from '@/utils/changedValues';
import getTimestamp from '@/utils/date-time/getTimestamp';
import isPresent from '@/utils/isPresent';

type PostEditorKind = Extract<ChatSubjectKind, 'draft' | 'edit'>;

type PostEditorProps = {
  kind: PostEditorKind;
  ideas: IdeasKind;
  post: PostEditorPost;
  onSave: (post: EditedPost, seed: EditedPost) => Promise<unknown>;
};

// Edits a post, its thread and its other channels, seeded from `post` ({ text, postAssets, postedAt,
// threadPosts, channelId, channelPosts }) into the sheet's draft (usePostDraft), as a draft sheet: the
// post's cards (PostCards), then its Other channels, each opening its step inside the sheet
// (PostChannelEditScreen). Add (a new post, `kind` 'draft') or Save (an edit) hands `onSave` the post
// the posts store takes (postData), allowed once every post of every channel has text or a photo (and,
// for Save, something changed), and the seed in the same shape, so an edit can save only what changed;
// a save that throws says so and keeps the editor open. A new post that opens empty has the cursor in
// its text, keyboard up. × or a swipe down with changes asks first. `kind` is also what the
// assistant's chat about the post's cards is about ('draft' a new post, 'edit' a saved one), and
// `ideas` which ideas the first card's tray offers, started on their own for a new post. The channel
// selector shows while the user has channels, or the post has a channel or other channels.
export default function PostEditor({ kind, ideas, post, onSave }: PostEditorProps) {
  const { draft, dispatch } = usePostDraft();
  const channels = useChannels();
  // A new post that opens empty (New post's card) is there to be written: its text takes the cursor.
  const [isOpenedEmpty] = useState(() => kind === 'draft' && !hasCardContent(post));

  useEffect(() => dispatch({ type: 'seed', post }), [dispatch, post]);

  const isNew = kind === 'draft';
  const seed = useMemo(() => postData(draftFromPost(post), post.postedAt), [post]);
  const pickedPostedAt = draft?.pickedPostedAt;
  const postedAt = pickedPostedAt === undefined ? post.postedAt : pickedPostedAt;
  // A new post's time is now until the user picks one, and a removed one is none: till then the
  // toolbar shows only its clock.
  const isPostedAtShown = postedAt != null && (kind === 'edit' || pickedPostedAt !== undefined);
  const data = draft && postData(draft, postedAt);
  const userChannelIds = useChannelOrder(channels);

  // The posts store syncs by itself. The save resolves an untouched Posted time (postedAtToSave): a
  // new post's is the time of the save.
  const { sheetProps } = useEditSheet({
    isNew,
    isValid: !!draft && [draft.main, ...draft.others].every((part) => part.cards.every(hasCardContent)),
    isDirty: !!data && isPresent(changedValues(seed, data)),
    save: () => {
      if (!data) throw new Error('The post editor saved before its draft was seeded');
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

  const dispatchMain = useCallback((action: ChannelDraftAction) => dispatch({ type: 'main', action }), [dispatch]);
  const openChannel = useCallback((key: string) => router.push(channelStepPath(key)), []);
  // The other channels' rows, kept while only the post's own cards change (a keystroke there).
  const others = draft?.others;
  const otherRows = useMemo(
    () =>
      (others ?? []).map((other) => ({
        key: other.key,
        channelId: other.channelId,
        text: other.cards[0]!.text,
        postAssets: other.cards[0]!.postAssets,
      })),
    [others],
  );
  const handleChangePostedAt = useCallback(
    (value: number | null) => dispatch({ type: 'pickPostedAt', postedAt: value }),
    [dispatch],
  );

  function renderBody() {
    if (!draft || !channels) return null;
    const hasChannelLeft = firstUnusedChannelId(draft, userChannelIds) !== undefined;
    const hasSelector = channels.length > 0 || !!draft.main.channelId || draft.others.length > 0;
    return (
      <View>
        <PostCards
          draft={draft.main}
          dispatch={dispatchMain}
          kind={kind}
          ideas={ideas}
          autoFocusFirst={isOpenedEmpty}
          postedAt={postedAt}
          isPostedAtShown={isPostedAtShown}
          onChangePostedAt={handleChangePostedAt}
          selector={
            hasSelector
              ? {
                  channels,
                  disabledIds: usedChannelIds(draft, draft.main.key),
                  onAddChannel: hasChannelLeft ? () => router.push(channelStepPath('new')) : undefined,
                }
              : undefined
          }
        />
        <OtherChannels posts={otherRows} channelOrder={userChannelIds} onOpen={openChannel} />
      </View>
    );
  }

  return (
    <EditSheet testID="post-editor" {...sheetProps}>
      {renderBody()}
    </EditSheet>
  );
}
