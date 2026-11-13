import { channelById, type ChatSubjectKind, type IdeasKind } from '@squidbox/shared';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import PostCard, { type PostCardChange } from './PostCard';
import type { PostedAtPickerProps } from './PostedAtPicker';
import type { ChannelDraft, ChannelDraftAction } from './draft/channelDraftReducer';
import hasCardContent from './draft/hasCardContent';
import nextCardKey from './draft/nextCardKey';

import ThreadConnector from '@/components/ThreadConnector';
import WarningNote from '@/components/WarningNote';
import toChatDraftPost from '@/features/post-chat/toChatDraftPost';
import IdeasTray from '@/features/post-ideas/IdeasTray';
import useEditorIdeas from '@/features/post-ideas/useEditorIdeas';
import { layout } from '@/styles/designTokens';
import confirmAsync from '@/utils/confirmAsync';

type PostCardsProps = {
  draft: ChannelDraft;
  dispatch: (action: ChannelDraftAction) => void;
  kind: Extract<ChatSubjectKind, 'draft' | 'edit'>;
  ideas: IdeasKind;
  startsOnItsOwn?: boolean;
  autoFocusFirst?: boolean;
  postedAt: PostedAtPickerProps['timestamp'];
  isPostedAtShown: boolean;
  onChangePostedAt: PostedAtPickerProps['onChange'];
};

/**
 * One channel's cards in the post editor (`draft`: the post and its thread), its edits going to
 * `dispatch` (channelDraftReducer): one card per post, joined by a short line, the card being edited
 * with the assistant's tray (its own chat about these cards, useEditorIdeas; ideas start on their own
 * only while `startsOnItsOwn`). The first card has the Posted time; every card follows the channel's limits; ⊕ Add to thread only where
 * the channel has threads (or there is none), and a note under the cards when one without threads
 * holds a thread anyway (its following posts stay, to edit or remove).
 */
export default function PostCards({
  draft,
  dispatch,
  kind,
  ideas,
  startsOnItsOwn = true,
  autoFocusFirst = false,
  postedAt,
  isPostedAtShown,
  onChangePostedAt,
}: PostCardsProps) {
  const { cards } = draft;
  const [activeKey, setActiveKey] = useState(cards[0]!.key);
  const channel = channelById(draft.channelId);
  const hasThreads = !channel || channel.hasThreads;

  const updateCard = useCallback(
    (key: string, changes: PostCardChange) => {
      dispatch({ type: 'updateCard', key, changes });
      setActiveKey(key);
    },
    [dispatch],
  );
  const setText = useCallback((key: string, text: string) => updateCard(key, { text }), [updateCard]);
  // The cards as the chat takes them.
  const posts = useMemo(() => cards.map((card) => toChatDraftPost(card.key, card)), [cards]);
  const { sessionId, settings } = useEditorIdeas({ kind, ideas, posts, activeKey, setText, startsOnItsOwn });

  function addToThread() {
    const key = nextCardKey(draft);
    dispatch({ type: 'addCard' });
    setActiveKey(key);
  }

  async function removeCard(key: string) {
    const card = cards.find((c) => c.key === key);
    if (!card) throw new Error(`No card ${key}`);
    if (hasCardContent(card)) {
      const isConfirmed = await confirmAsync({
        title: 'Remove this post?',
        message: 'Its text and photos go with it.',
        action: 'Remove',
        destructive: true,
      });
      if (!isConfirmed) return;
    }
    dispatch({ type: 'removeCard', key });
    if (activeKey === key) setActiveKey(cards[0]!.key);
  }

  return (
    <View>
      {cards.map((card, index) => (
        <View key={card.key}>
          {index > 0 && <ThreadConnector />}
          <PostCard
            card={card}
            isFirst={index === 0}
            isActive={card.key === activeKey}
            autoFocus={index === 0 && autoFocusFirst}
            postedAt={postedAt}
            isPostedAtShown={isPostedAtShown}
            onChangePostedAt={onChangePostedAt}
            onChange={updateCard}
            onActivate={setActiveKey}
            onRemove={index > 0 ? removeCard : undefined}
            onAddToThread={hasThreads && index === cards.length - 1 ? addToThread : undefined}
            limits={channel}
            tray={
              card.key === activeKey && (
                <IdeasTray
                  sessionId={sessionId}
                  target={card.key}
                  ideas={index === 0 ? ideas : null}
                  settings={settings}
                />
              )
            }
          />
        </View>
      ))}
      {channel && !channel.hasThreads && cards.length > 1 && (
        <WarningNote style={styles.note}>{`${channel.name} has no threads.`}</WarningNote>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    marginTop: layout.cardGap,
  },
});
