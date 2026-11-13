import { channelById, type Channel } from '@squidbox/shared';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useReducer, useState } from 'react';

import PostCards from './PostCards';
import channelDraftReducer from './draft/channelDraftReducer';
import hasCardContent from './draft/hasCardContent';
import newChannelDraft from './draft/newChannelDraft';
import postData from './draft/postData';
import type { OtherChannelDraft, PostDraft, PostDraftAction } from './draft/postDraftReducer';
import usePostDraft from './draft/usePostDraft';
import usedChannelIds from './draft/usedChannelIds';

import EditSheet from '@/components/EditSheet';
import useChannelOrder from '@/features/channels/useChannelOrder';
import useChannels from '@/features/channels/useChannels';
import useCloseWhen from '@/hooks/useCloseWhen';
import useEditSheet from '@/hooks/useEditSheet';
import changedValues from '@/utils/changedValues';
import confirmAsync from '@/utils/confirmAsync';
import isPresent from '@/utils/isPresent';

/**
 * Another channel of the post, pushed inside the post editor's sheet (`key`: a channel of the sheet's
 * draft, or `new` for one on the next of the user's channels the post doesn't use, holding the post's
 * first card's text and media). A draft of its own: it edits a copy, Done puts it into the sheet's draft
 * and goes back, Back drops its changes (asking first when there are any); nothing is saved before the
 * sheet's Add or Save. Its cards are PostCards with the channel's selector (the post's other channels
 * off), without a Posted time; one opened from its row ends with Remove <Channel> from this post. A key
 * the draft doesn't hold, no channel left for a new one, or no draft (opened by a link) closes it.
 */
export default function PostChannelEditScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { draft: postDraft, dispatch } = usePostDraft();
  const channels = useChannels();
  const channelOrder = useChannelOrder(channels);
  // The copy the step edits, taken once: the sheet's draft may change under it (its own Remove).
  const [seed, setSeed] = useState<OtherChannelDraft | null>(null);
  const isNew = key === 'new';

  // Undefined while the channels are read; null with nothing to edit: a key the draft doesn't hold, no
  // channel left for a new one, or no draft at all (the step opened by a link or a reload).
  const found = (() => {
    if (seed) return seed;
    if (!channels) return undefined;
    if (!postDraft) return null;
    if (isNew) return newChannelDraft(postDraft, channelOrder);
    return postDraft.others.find((other) => other.key === key) ?? null;
  })();
  if (!seed && found) setSeed(found);
  useCloseWhen(found === null);

  if (!seed || !postDraft || !channels) return null;
  return <ChannelStep seed={seed} isNew={isNew} postDraft={postDraft} channels={channels} dispatch={dispatch} />;
}

type ChannelStepProps = {
  seed: OtherChannelDraft;
  isNew: boolean;
  postDraft: PostDraft;
  channels: Channel[];
  dispatch: (action: PostDraftAction) => void;
};

// The step's sheet over its own copy of the channel, seeded once.
function ChannelStep({ seed, isNew, postDraft, channels, dispatch }: ChannelStepProps) {
  const [local, localDispatch] = useReducer(channelDraftReducer<OtherChannelDraft>, seed);
  const seedData = useMemo(() => postData({ main: seed, others: [] }, null), [seed]);

  const channel = channelById(local.channelId);
  const name = channel?.name ?? 'this channel';
  const { sheetProps, finish } = useEditSheet({
    isNew,
    isValid: local.cards.every(hasCardContent),
    isDirty: isPresent(changedValues(seedData, postData({ main: local, others: [] }, null))),
    save: async () => dispatch({ type: 'putChannel', channel: local }),
    syncsItself: true,
  });

  async function handleRemove() {
    const isConfirmed = await confirmAsync({
      title: `Remove ${name} from this post?`,
      message: 'Its text and photos go with it.',
      action: 'Remove',
      destructive: true,
    });
    if (!isConfirmed) return;
    await finish(async () => dispatch({ type: 'removeChannel', key: local.key }), "Couldn't remove the channel");
  }

  return (
    <EditSheet
      testID="post-channel-editor"
      {...sheetProps}
      title={channel?.name}
      confirmLabel="Done"
      actions={isNew ? [] : [{ label: `Remove ${name} from this post`, colorPalette: 'danger', onPress: handleRemove }]}
    >
      <PostCards
        draft={local}
        dispatch={localDispatch}
        kind={local.id ? 'edit' : 'draft'}
        ideas="post"
        startsOnItsOwn={false}
        selector={{ channels, disabledIds: usedChannelIds(postDraft, local.key) }}
      />
    </EditSheet>
  );
}
