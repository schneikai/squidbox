import type { NewPromptButton } from '@squidbox/shared';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import AssistantMessage from './AssistantMessage';
import ChatComposer from './ChatComposer';
import ChatSubjectCard from './ChatSubjectCard';
import SystemMessageSheet from './SystemMessageSheet';
import UserMessage from './UserMessage';
import type { AssistantChatMessage, ChatMessage, ChatSeed } from './chatSessions';
import promptTurn from './promptTurn';
import type { LiveChat } from './useChatSession';
import usePostChat, { type PostChatState } from './usePostChat';
import useWritingModelName from './useWritingModelName';

import Button from '@/components/Button';
import MenuButton from '@/components/MenuButton';
import ModalHeader, { type ModalHeaderProps } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import { SCREEN_PADDING } from '@/constants';
import EditPromptButtonsButton from '@/features/prompt-buttons/EditPromptButtonsButton';
import PromptButtonRow from '@/features/prompt-buttons/PromptButtonRow';
import usePromptButtons from '@/features/prompt-buttons/usePromptButtons';
import useAvailableUserId from '@/hooks/useAvailableUserId';
import useCloseWhen from '@/hooks/useCloseWhen';
import useHaptics from '@/hooks/useHaptics';
import useHasFeature from '@/hooks/useHasFeature';
import useKeyboardInset from '@/hooks/useKeyboardInset';
import { layout, space } from '@/styles/designTokens';
import confirmAsync from '@/utils/confirmAsync';

const ASK_ANYTHING = 'Ask anything';
const WRITING_AS_YOU = 'Writing as you';

type ChatParams = { sessionId: string; label?: string; prompt?: string };

/**
 * The assistant chat about the post being written (`sessionId`, the editor's chat; `label` and
 * `prompt`, a prompt button's name and prompt, wait in the composer): what it's about (ChatSubjectCard,
 * left out for a new post without photos yet), the user's turns and the assistant's replies with
 * their options, and the prompt buttons over the composer, a tap putting the prompt in it
 * (usePostChat does the sending). Use puts an option into the caption and goes back to the editor.
 * The chat lasts while the editor or the post's screen is open; a posted post's options have Copy.
 */
export default function PostChatScreen() {
  const { sessionId, label, prompt } = useLocalSearchParams<ChatParams>();
  const userId = useAvailableUserId();
  const postChat = usePostChat(sessionId);
  const { chat } = postChat;
  useCloseWhen(chat === null);

  if (userId === null || !chat) return null;

  return <PostChat {...postChat} chat={chat} userId={userId} label={label} prompt={prompt} />;
}

type PostChatProps = Omit<PostChatState, 'chat'> & { chat: LiveChat; userId: string } & Pick<
    ChatParams,
    'label' | 'prompt'
  >;

// The open chat: everything the screen shows once it has one.
function PostChat({
  chat,
  assets,
  tagging,
  mentions,
  isWaiting,
  send,
  moreLikeThis,
  retry,
  userId,
  label,
  prompt,
}: PostChatProps) {
  const navigation = useNavigation();
  const haptics = useHaptics();
  const buttons = usePromptButtons();
  // What waits in the composer: a new `key` remounts it with the prompt a button put there.
  const [seed, setSeed] = useState<{ key: number; turn: ChatSeed | undefined }>(() => ({
    key: 0,
    turn: prompt ? { label, content: prompt } : undefined,
  }));
  const isAiAdmin = useHasFeature('ai_admin');
  const [isSystemMessageOpen, setIsSystemMessageOpen] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const shouldScrollRef = useRef(false);
  const bottomInset = useKeyboardInset();
  const { messages } = chat;

  // A new turn or a reply that landed: show the end of the chat once it's laid out.
  useEffect(() => {
    if (messages.length) shouldScrollRef.current = true;
  }, [messages]);

  const composerStyle = useAnimatedStyle(() => ({
    paddingBottom: bottomInset.value,
  }));

  const last = messages[messages.length - 1];
  // The system prompt of the newest reply that has it (an ai_admin's, from the server).
  const systemMessage = messages.findLast(hasSystemMessage)?.systemMessage ?? null;
  // A new post's card would say only "New post" until it has photos.
  const hasSubject = chat.kind !== 'draft' || assets.length > 0;
  const { applyText, canApply } = chat;

  const handleUse = useCallback(
    (text: string) => {
      applyText(text);
      haptics.success();
      navigation.goBack();
    },
    [applyText, haptics, navigation],
  );

  function handlePromptButton(button: NewPromptButton) {
    setSeed((current) => ({ key: current.key + 1, turn: promptTurn(button) }));
  }

  // There is no chat history yet, so a cleared chat is gone for good: ask, unless it's empty.
  async function handleNewChat() {
    const message = "This chat is cleared and can't be brought back.";
    const confirm = { title: 'New chat', message, action: 'New chat', destructive: true };
    if (messages.length > 0 && !(await confirmAsync(confirm))) return;
    chat.reset();
  }

  function handleContentSizeChange() {
    if (!shouldScrollRef.current) return;
    shouldScrollRef.current = false;
    scrollRef.current?.scrollToEnd({ animated: true });
  }

  return (
    <ModalSheet>
      <ChatHeader
        isAiAdmin={isAiAdmin}
        leading={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
        trailing={
          isAiAdmin ? (
            // New chat is always there, so the ⋯ button never pops in with the first message.
            <MenuButton accessibilityLabel="Chat options">
              <MenuOption label="New chat" icon="edit" onPress={handleNewChat} />
              {systemMessage && (
                <MenuOption label="System prompt" icon="document" onPress={() => setIsSystemMessageOpen(true)} />
              )}
            </MenuButton>
          ) : (
            <Button icon="edit" onPress={handleNewChat} disabled={!messages.length} accessibilityLabel="New chat" />
          )
        }
      />
      <ScrollView
        ref={scrollRef}
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
            onEditMentions={chat.editMentions}
          />
        )}
        {messages.map((message, index) =>
          message.role === 'user' ? (
            <UserMessage key={message.id} label={message.label} content={message.content} userId={userId} />
          ) : (
            <AssistantMessage
              key={message.id}
              reply={message}
              onRetry={message === last ? retry : null}
              onMoreLikeThis={moreLikeThis}
              onUse={canApply ? handleUse : null}
            />
          ),
        )}
      </ScrollView>
      <Animated.View style={[styles.composer, composerStyle]}>
        <PromptButtonRow buttons={buttons ?? []} onPress={handlePromptButton}>
          <EditPromptButtonsButton />
        </PromptButtonRow>
        <View style={styles.composerInset}>
          <ChatComposer
            key={seed.key}
            seed={seed.turn}
            placeholder={messages.length === 0 ? ASK_ANYTHING : 'Message'}
            disabled={chat.isSending}
            isWaiting={isWaiting}
            onSend={send}
          />
        </View>
      </Animated.View>
      <SystemMessageSheet
        isVisible={isSystemMessageOpen}
        onClose={() => setIsSystemMessageOpen(false)}
        systemMessage={systemMessage}
      />
    </ModalSheet>
  );
}

// A reply that carries the system prompt: a type predicate, so findLast's result is the reply.
function hasSystemMessage(message: ChatMessage): message is AssistantChatMessage {
  return message.role === 'assistant' && Boolean(message.systemMessage);
}

// The header's buttons, which the screen gives.
type HeaderSlots = Pick<ModalHeaderProps, 'leading' | 'trailing'>;

type ChatHeaderProps = HeaderSlots & { isAiAdmin: boolean };

// The chat's header: "Writing as you" under the title, or for an ai_admin the writing model's name
// (its hooks run only for one).
function ChatHeader({ isAiAdmin, ...headerProps }: ChatHeaderProps) {
  if (isAiAdmin) return <ModelNameHeader {...headerProps} />;
  return <ModalHeader {...headerProps} title="Assistant" subtitle={WRITING_AS_YOU} />;
}

// An ai_admin's header: the writing model's name under the title, once it loaded.
function ModelNameHeader(headerProps: HeaderSlots) {
  const modelName = useWritingModelName();
  return <ModalHeader {...headerProps} title="Assistant" subtitle={modelName ?? WRITING_AS_YOU} />;
}

const styles = StyleSheet.create({
  content: {
    paddingTop: layout.sheetContentTop,
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: layout.contentEnd,
    gap: space.md,
  },
  // The prompt buttons scroll to the screen's edges; the composer keeps the screen's inset.
  composer: {
    paddingTop: space.sm,
    gap: space.sm,
  },
  composerInset: {
    paddingHorizontal: SCREEN_PADDING,
  },
});
