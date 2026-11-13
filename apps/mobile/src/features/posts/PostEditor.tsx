import { channelName, type ChatSubjectKind, type IdeasKind } from '@squidbox/shared';
import { memo, useCallback, useMemo, useReducer, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import PostCards from './PostCards';
import type { PostedAtPickerProps } from './PostedAtPicker';
import type { ChannelDraft, ChannelDraftAction } from './draft/channelDraftReducer';
import { MAIN_KEY } from './draft/channelKey';
import draftChannel from './draft/draftChannel';
import draftFromPost from './draft/draftFromPost';
import hasCardContent from './draft/hasCardContent';
import postData from './draft/postData';
import postDraftReducer, { type EditedPost, type PostDraftAction, type PostEditorPost } from './draft/postDraftReducer';
import postedAtToSave from './postedAtToSave';

import EditSheet from '@/components/EditSheet';
import ChannelBar from '@/features/channels/ChannelBar';
import orderPostChannels from '@/features/channels/orderPostChannels';
import useChannelOrder from '@/features/channels/useChannelOrder';
import useChannelSlide from '@/features/channels/useChannelSlide';
import useChannels from '@/features/channels/useChannels';
import useEditSheet from '@/hooks/useEditSheet';
import { layout } from '@/styles/designTokens';
import changedValues from '@/utils/changedValues';
import confirmRemoveAsync from '@/utils/confirmRemoveAsync';
import getTimestamp from '@/utils/date-time/getTimestamp';
import isPresent from '@/utils/isPresent';

type PostEditorKind = Extract<ChatSubjectKind, 'draft' | 'edit'>;

type PostEditorProps = {
  kind: PostEditorKind;
  ideas: IdeasKind;
  post: PostEditorPost;
  selectedChannelPostId?: string;
  onSave: (post: EditedPost, seed: EditedPost) => Promise<unknown>;
};

// Edits a post, its thread and its other channels, seeded once from `post` ({ text, postAssets,
// postedAt, threadPosts, channelId, channelPosts }) into its draft (postDraftReducer), as a draft
// sheet: the channel bar (ChannelBar) on top, then the cards (PostCards) of the channel it selects,
// first the one saved as `selectedChannelPostId` (Edit from the post screen) else the post's own. Every
// channel's cards stay mounted, the others hidden, so a switch loses nothing (each keeps its assistant
// chat). Add (a new post, `kind` 'draft') or Save (an edit) hands `onSave` the post the posts store
// takes (postData), allowed once every post of every channel has text or a photo (and, for Save,
// something changed), and the seed in the same shape, so an edit can save only what changed; a save
// that throws says so and keeps the editor open. A new post that opens empty has the cursor in its
// text, keyboard up. × or a swipe down with changes asks first. `kind` is also what the assistant's
// chat about the post's own cards is about ('draft' a new post, 'edit' a saved one), and `ideas` which
// ideas their first card's tray offers, started on their own for a new post. The bar shows while the
// user has channels, or the post has a channel or other channels.
export default function PostEditor({ kind, ideas, post, selectedChannelPostId, onSave }: PostEditorProps) {
  const [draft, dispatch] = useReducer(postDraftReducer, post, (seedPost) =>
    draftFromPost(seedPost, selectedChannelPostId),
  );
  const channels = useChannels();
  const channelOrder = useChannelOrder(channels);
  const isNew = kind === 'draft';
  // A new post that opens empty (New post's card) is there to be written: its text takes the cursor.
  const [isOpenedEmpty] = useState(() => isNew && !hasCardContent(post));
  const seed = useMemo(() => postData(draftFromPost(post), post.postedAt), [post]);
  const { pickedPostedAt } = draft;
  const postedAt = pickedPostedAt === undefined ? post.postedAt : pickedPostedAt;
  // A new post's time is now until the user picks one, and a removed one is none: till then the
  // toolbar shows only its clock.
  const isPostedAtShown = postedAt != null && (kind === 'edit' || pickedPostedAt !== undefined);
  const data = postData(draft, postedAt);
  const parts = [draft.main, ...draft.others];
  const orderedParts = orderPostChannels(parts, (part) => part.channelId, channelOrder);
  const slide = useChannelSlide(
    draft.selectedKey,
    orderedParts.map((part) => part.key),
  );

  // The posts store syncs by itself. The save resolves an untouched Posted time (postedAtToSave): a
  // new post's is the time of the save.
  const { sheetProps } = useEditSheet({
    isNew,
    isValid: parts.every((part) => part.cards.every(hasCardContent)),
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

  const handleChangePostedAt = useCallback(
    (value: number | null) => dispatch({ type: 'pickPostedAt', postedAt: value }),
    [],
  );

  // The focused text would be a hidden channel's.
  function handleSelect(key: string) {
    Keyboard.dismiss();
    dispatch({ type: 'select', key });
  }

  async function handleRemove() {
    const selected = draftChannel(draft, draft.selectedKey);
    if (selected.cards.some(hasCardContent)) {
      if (!(await confirmRemoveAsync(`${channelName(selected.channelId)} from this post`))) return;
    }
    Keyboard.dismiss();
    dispatch({ type: 'removeChannel', key: selected.key, channelOrder });
  }

  function renderBody() {
    if (!channels) return null;
    const hasBar = channels.length > 0 || !!draft.main.channelId || draft.others.length > 0;
    return (
      <View>
        {hasBar && (
          <ChannelBar
            parts={orderedParts}
            selectedKey={draft.selectedKey}
            onSelect={handleSelect}
            editing={{
              channels,
              onAdd: (channelId) => dispatch({ type: 'addChannel', channelId }),
              onChange: (channelId) =>
                dispatch({ type: 'channel', key: draft.selectedKey, action: { type: 'setChannel', channelId } }),
              onRemove: parts.length > 1 ? handleRemove : undefined,
            }}
            style={styles.bar}
          />
        )}
        <Animated.View style={slide}>
          {parts.map((part) => (
            <ChannelPanel
              key={part.key}
              channel={part}
              isSelected={part.key === draft.selectedKey}
              isOpenedPost={part.key === MAIN_KEY}
              dispatch={dispatch}
              kind={kind}
              ideas={ideas}
              isOpenedEmpty={isOpenedEmpty}
              postedAt={postedAt}
              isPostedAtShown={isPostedAtShown}
              onChangePostedAt={handleChangePostedAt}
            />
          ))}
        </Animated.View>
      </View>
    );
  }

  return (
    <EditSheet testID="post-editor" {...sheetProps}>
      {renderBody()}
    </EditSheet>
  );
}

type ChannelPanelProps = {
  channel: ChannelDraft;
  isSelected: boolean;
  isOpenedPost: boolean;
  dispatch: (action: PostDraftAction) => void;
  kind: PostEditorKind;
  ideas: IdeasKind;
  isOpenedEmpty: boolean;
  postedAt: PostedAtPickerProps['timestamp'];
  isPostedAtShown: boolean;
  onChangePostedAt: PostedAtPickerProps['onChange'];
};

// One channel's cards, mounted while the channel is in the draft and hidden (from the eye and from
// VoiceOver) while another shows. Memoized, with its own dispatch, so a keystroke draws only the
// channel being edited. What its chat is about is fixed as it mounts: the post's own channel as the
// sheet opened is the post (`kind`, its `ideas`, started on their own for a new post), another is
// its saved copy ('edit') or a new one ('draft'). The post's own takes the cursor when the sheet
// opened empty (`isOpenedEmpty`).
const ChannelPanel = memo(function ChannelPanel({
  channel,
  isSelected,
  isOpenedPost,
  dispatch,
  kind,
  ideas,
  isOpenedEmpty,
  postedAt,
  isPostedAtShown,
  onChangePostedAt,
}: ChannelPanelProps) {
  const { key } = channel;
  const [chatKind] = useState<PostEditorKind>(() => (isOpenedPost ? kind : channel.id ? 'edit' : 'draft'));
  const dispatchChannel = useCallback(
    (action: ChannelDraftAction) => dispatch({ type: 'channel', key, action }),
    [dispatch, key],
  );

  return (
    <View
      testID={isSelected ? 'post-editor-channel' : undefined}
      accessibilityElementsHidden={!isSelected}
      importantForAccessibility={isSelected ? 'auto' : 'no-hide-descendants'}
      aria-hidden={!isSelected}
      style={!isSelected && styles.hidden}
    >
      <PostCards
        draft={channel}
        dispatch={dispatchChannel}
        kind={chatKind}
        ideas={isOpenedPost ? ideas : 'post'}
        startsOnItsOwn={isOpenedPost}
        autoFocusFirst={isOpenedPost && isOpenedEmpty}
        postedAt={postedAt}
        isPostedAtShown={isPostedAtShown}
        onChangePostedAt={onChangePostedAt}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    marginBottom: layout.cardGap,
  },
  hidden: {
    display: 'none',
  },
});
