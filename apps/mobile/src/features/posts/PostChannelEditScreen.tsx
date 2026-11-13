import { channelById } from '@squidbox/shared';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useReducer, useState } from 'react';

import PostCards from './PostCards';
import channelDraftReducer, { hasCardContent, type ChannelDraftAction } from './draft/channelDraftReducer';
import { newChannelDraft, usedChannelIds, type OtherChannelDraft } from './draft/postDraftReducer';
import usePostDraft from './draft/usePostDraft';

import EditSheet from '@/components/EditSheet';
import useChannels from '@/features/channels/useChannels';
import useEditSheet from '@/hooks/useEditSheet';
import confirmAsync from '@/utils/confirmAsync';

// The step's own copy of the channel it edits: null until seeded.
function stepReducer(
  draft: OtherChannelDraft | null,
  action: ChannelDraftAction | { type: 'seed'; draft: OtherChannelDraft },
): OtherChannelDraft | null {
  if (action.type === 'seed') return action.draft;
  return draft && channelDraftReducer(draft, action);
}

/**
 * Another channel of the post, pushed inside the post editor's sheet (`key`: a channel of the sheet's
 * draft, or `new` for one on the next of the user's channels the post doesn't use, holding the post's
 * first card's text and media). A draft of its own: it edits a copy, Done puts it into the sheet's draft
 * and goes back, Back drops its changes (asking first when there are any); nothing is saved before the
 * sheet's Add or Save. Its cards are PostCards with the channel's selector (the post's other channels
 * off), without a Posted time; one opened from its row ends with Remove <Channel> from this post. A key
 * the draft doesn't hold, or no channel left for a new one, closes it.
 */
export default function PostChannelEditScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const navigation = useNavigation();
  const { draft: postDraft, dispatch } = usePostDraft();
  const channels = useChannels();
  const [local, localDispatch] = useReducer(stepReducer, null);
  const [seed, setSeed] = useState<OtherChannelDraft | null>(null);
  const isNew = key === 'new';

  useEffect(() => {
    if (seed || !channels) return;
    const found = !postDraft
      ? null
      : isNew
        ? newChannelDraft(
            postDraft,
            channels.map((channel) => channel.id),
          )
        : (postDraft.others.find((other) => other.key === key) ?? null);
    if (!found) {
      navigation.goBack();
      return;
    }
    setSeed(found);
    localDispatch({ type: 'seed', draft: found });
  }, [seed, channels, postDraft, isNew, key, navigation]);

  const channel = channelById(local?.channelId);
  const { sheetProps, finish } = useEditSheet({
    isNew,
    isValid: !!local && local.cards.every(hasCardContent),
    isDirty: !!local && JSON.stringify(local) !== JSON.stringify(seed),
    save: async () => {
      if (local) dispatch({ type: 'putChannel', channel: local });
    },
    syncsItself: true,
  });

  async function handleRemove(channelKey: string) {
    const name = channel?.name ?? 'this channel';
    const isConfirmed = await confirmAsync({
      title: `Remove ${name} from this post?`,
      message: 'Its text and photos go with it.',
      action: 'Remove',
      destructive: true,
    });
    if (!isConfirmed) return;
    await finish(async () => dispatch({ type: 'removeChannel', key: channelKey }), "Couldn't remove the channel");
  }

  return (
    <EditSheet
      testID="post-channel-editor"
      {...sheetProps}
      title={channel?.name}
      confirmLabel="Done"
      actions={
        !isNew && local
          ? [
              {
                label: `Remove ${channel?.name ?? 'this channel'} from this post`,
                colorPalette: 'danger',
                onPress: () => handleRemove(local.key),
              },
            ]
          : []
      }
    >
      {local && postDraft && channels && (
        <PostCards
          draft={local}
          dispatch={localDispatch}
          kind={local.id ? 'edit' : 'draft'}
          ideas="post"
          startsOnItsOwn={false}
          selector={{ channels, disabledIds: usedChannelIds(postDraft, local.key) }}
        />
      )}
    </EditSheet>
  );
}
