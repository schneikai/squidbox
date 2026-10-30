import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import AssistantMessage from './AssistantMessage';
import ChatComposer from './ChatComposer';
import ChatSubjectCard from './ChatSubjectCard';
import UserMessage from './UserMessage';
import promptTurn from './promptTurn';
import usePostChat from './usePostChat';

import Button from '@/components/Button';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import { SCREEN_PADDING } from '@/constants';
import useFavoriteToggle from '@/features/favorites/useFavoriteToggle';
import EditPromptButtonsButton from '@/features/prompt-buttons/EditPromptButtonsButton';
import PromptButtonRow from '@/features/prompt-buttons/PromptButtonRow';
import usePromptButtons from '@/features/prompt-buttons/usePromptButtons';
import useCloseWhen from '@/hooks/useCloseWhen';
import useHaptics from '@/hooks/useHaptics';
import useKeyboardInset from '@/hooks/useKeyboardInset';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useScrollY from '@/hooks/useScrollY';
import confirmAsync from '@/utils/confirmAsync';

const ASK_ANYTHING = 'Ask anything';

/**
 * The assistant chat about the post being written (`{ sessionId }`, the editor's chat; `prompt`, a
 * prompt button's `{ label, content }`, waits in the composer): what it's about (ChatSubjectCard,
 * left out for a new post without photos yet), the user's turns and the assistant's replies with
 * their options, and the prompt buttons over the composer, a tap putting the prompt in it
 * (usePostChat does the sending). Use puts an option into the caption and goes back to the editor.
 * The chat lasts while the editor is open.
 */
export default function PostChatScreen({ route, navigation }) {
  const { sessionId, prompt } = route.params;
  const isAvailable = useLeaveWhenUnavailable();
  const { chat, assets, tagging, mentions, isWaiting, send, moreLikeThis, retry } = usePostChat(sessionId);
  useCloseWhen(chat === null);
  const haptics = useHaptics();
  const buttons = usePromptButtons();
  // What waits in the composer: a new `key` remounts it with the prompt a button put there.
  const [seed, setSeed] = useState(() => ({ key: 0, turn: prompt }));
  const favorites = useFavoriteToggle();
  const scrollRef = useRef(null);
  // The title fades as the messages scroll under the header, as on the other sheets (ModalHeader).
  const { scrollY, onScroll } = useScrollY();
  const shouldScrollRef = useRef(false);
  const bottomInset = useKeyboardInset(8);
  const messages = chat?.messages;

  // A new turn or a reply that landed: show the end of the chat once it's laid out.
  useEffect(() => {
    if (messages?.length) shouldScrollRef.current = true;
  }, [messages]);

  const composerStyle = useAnimatedStyle(() => ({
    paddingBottom: bottomInset.value,
  }));

  const last = messages?.[messages.length - 1];
  // A new post's card would say only "New post" until it has photos.
  const hasSubject = chat?.kind !== 'draft' || assets.length > 0;
  const applyText = chat?.canApply ? chat.applyText : null;

  const handleUse = useCallback(
    (text) => {
      applyText(text);
      haptics.success();
      navigation.goBack();
    },
    [applyText, haptics, navigation],
  );

  function handlePromptButton(button) {
    setSeed((current) => ({ key: current.key + 1, turn: promptTurn(button) }));
  }

  // There is no chat history yet, so a cleared chat is gone for good.
  async function handleNewChat() {
    const message = "This chat is cleared and can't be brought back.";
    if (!(await confirmAsync({ title: 'New chat', message, action: 'New chat', destructive: true }))) return;
    chat.reset();
  }

  function handleContentSizeChange() {
    if (!shouldScrollRef.current) return;
    shouldScrollRef.current = false;
    scrollRef.current?.scrollToEnd({ animated: true });
  }

  if (!isAvailable || !chat) return null;

  return (
    <ModalSheet>
      <ModalHeader
        leftSlot={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
        centerSlot="Assistant"
        subtitle="Writing as you"
        scrollY={scrollY}
        rightSlot={
          <Button icon="edit" onPress={handleNewChat} disabled={!messages?.length} accessibilityLabel="New chat" />
        }
      />
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={handleContentSizeChange}
        contentContainerStyle={styles.content}
      >
        {hasSubject && (
          <ChatSubjectCard
            kind={chat.kind}
            assets={assets}
            tagging={tagging}
            tagEdits={chat.tagEdits}
            onEditTags={chat.editTags}
            mentions={mentions}
          />
        )}
        {messages.map((message, index) =>
          message.role === 'user' ? (
            <UserMessage key={message.id} label={message.label} content={message.content} />
          ) : (
            <AssistantMessage
              key={message.id}
              reply={message}
              favorites={favorites}
              onRetry={message === last ? retry : null}
              onMoreLikeThis={moreLikeThis}
              onUse={applyText ? handleUse : null}
            />
          ),
        )}
      </Animated.ScrollView>
      <Animated.View style={[styles.composer, composerStyle]}>
        <PromptButtonRow
          buttons={buttons ?? []}
          onPress={handlePromptButton}
          style={styles.buttons}
          contentContainerStyle={styles.buttonsContent}
        >
          <EditPromptButtonsButton />
        </PromptButtonRow>
        <ChatComposer
          key={seed.key}
          seed={seed.turn}
          placeholder={messages.length === 0 ? ASK_ANYTHING : 'Message'}
          disabled={chat.isSending}
          isWaiting={isWaiting}
          onSend={send}
        />
      </Animated.View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: MODAL_HEADER_HEIGHT,
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: SCREEN_PADDING,
    gap: 12,
  },
  composer: {
    paddingTop: 8,
    paddingHorizontal: SCREEN_PADDING,
    gap: 8,
  },
  // The buttons scroll to the screen's edges, under the composer's inset.
  buttons: {
    marginHorizontal: -SCREEN_PADDING,
  },
  buttonsContent: {
    paddingHorizontal: SCREEN_PADDING,
  },
});
