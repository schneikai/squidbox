import type { NewPromptButton } from '@squidbox/shared';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { type ComponentRef, Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import AssistantMessage from './AssistantMessage';
import ChatComposer from './ChatComposer';
import ChatSubjectCard from './ChatSubjectCard';
import SystemMessageSheet from './SystemMessageSheet';
import UserMessage from './UserMessage';
import { type AssistantChatMessage, type ChatMessage, type ChatSeed, canUseFor } from './chatSessions';
import type { LiveChat } from './useChatSession';
import usePostChat, { type PostChatState } from './usePostChat';
import useWritingModelName from './useWritingModelName';
import usedNote from './usedNote';

import Button from '@/components/Button';
import Divider from '@/components/Divider';
import MenuButton from '@/components/MenuButton';
import ModalHeader, { type ModalHeaderProps } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import Text from '@/components/Text';
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

export type ChatParams = { sessionId: string };

/**
 * The assistant chat about the post being written and its thread (`sessionId`, the editor's one
 * chat, or the post screen's): what it's about (ChatSubjectCard, left out for a new post without
 * photos yet), every turn so far (the tray's ideas and More among them) with the post it wrote for
 * named where that changes in a thread, the assistant's replies with their options, and the prompt
 * buttons over the composer, a tap putting the prompt in it; the composer writes for the post being
 * edited (usePostChat does the sending). Use puts an option into the post its turn wrote for and goes
 * back to the editor. The chat lasts while the editor or the post's screen is open; a posted post's
 * options, and a removed post's, have Copy. Opening it tags its photos never tagged.
 */
export default function PostChatScreen() {
  const { sessionId } = useLocalSearchParams<ChatParams>();
  const userId = useAvailableUserId();
  const postChat = usePostChat(sessionId, { tagsOnOpen: true });
  useCloseWhen(postChat.chat === null);

  const { chat } = postChat;

  if (userId === null || !chat) return null;

  return <PostChat {...postChat} chat={chat} userId={userId} />;
}

type PostChatProps = Omit<PostChatState, 'chat'> & { chat: LiveChat; userId: string };

// The open chat: everything the screen shows once it has one.
function PostChat({ chat, assets, tagging, mentions, send, moreLikeThis, retry, userId }: PostChatProps) {
  const navigation = useNavigation();
  const haptics = useHaptics();
  const buttons = usePromptButtons();
  // What waits in the composer: a new `key` remounts it with the prompt a button put there.
  const [seed, setSeed] = useState<{ key: number; turn: ChatSeed | undefined }>({ key: 0, turn: undefined });
  const isAiAdmin = useHasFeature('ai_admin');
  const [isSystemMessageOpen, setIsSystemMessageOpen] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const shouldScrollRef = useRef(false);
  const bottomInset = useKeyboardInset();
  const { messages, targets, activeTarget } = chat;

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
  const { use } = chat;
  // A thread names the post each turn wrote for, where that changes.
  const isThread =
    targets.length > 1 || messages.some((message) => message.role === 'user' && !targets.includes(message.target));
  // More like this writes for the post the option was written for: one callback per post, so the
  // replies keep theirs (memo).
  const moreLikeThisFor = useMemo(() => {
    const byTarget = new Map<string, (text: string) => void>();
    return (target: string) => {
      if (!byTarget.has(target)) byTarget.set(target, (text) => moreLikeThis(text, target));
      return byTarget.get(target)!;
    };
  }, [moreLikeThis]);

  const handleUse = useCallback(
    (replyId: string, index: number) => {
      use(replyId, index);
      haptics.success();
      navigation.goBack();
    },
    [use, haptics, navigation],
  );

  function handlePromptButton(button: NewPromptButton) {
    setSeed((current) => ({ key: current.key + 1, turn: { label: button.name, content: button.prompt } }));
  }

  function handleSend(turn: Required<ChatSeed>) {
    return activeTarget !== null && send({ ...turn, kind: 'message', target: activeTarget });
  }

  // The post's number from 1 in the thread, null outside one or once it was removed.
  function postNumber(target: string) {
    const at = targets.indexOf(target);
    return isThread && at !== -1 ? at + 1 : null;
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
    <ModalSheet testID="post-chat">
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
            postCount={targets.length}
            assets={assets}
            tagging={tagging}
            tagEdits={chat.tagEdits}
            onEditTags={chat.editTags}
            mentions={mentions}
            onEditMentions={chat.editMentions}
          />
        )}
        {messages.map((message, index) => {
          if (message.role === 'user') {
            const before = messages.slice(0, index).findLast((each) => each.role === 'user');
            const isNewPost = isThread && before?.target !== message.target;
            const number = postNumber(message.target);
            return (
              <Fragment key={message.id}>
                {isNewPost && (
                  <PostDivider title={number === null ? 'A removed post' : `Post ${number} of the thread`} />
                )}
                <UserMessage label={message.label} content={message.content} userId={userId} />
              </Fragment>
            );
          }
          const turn = messages[index - 1];
          const target = turn?.role === 'user' ? turn.target : null;
          const isLive = target !== null && targets.includes(target);
          return (
            <AssistantMessage
              key={message.id}
              reply={message}
              onRetry={message === last ? retry : null}
              onMoreLikeThis={isLive ? moreLikeThisFor(target) : null}
              onUse={target !== null && canUseFor(chat, target) ? handleUse : null}
              usedNote={
                message.usedOption === null || target === null ? null : usedNote(message.usedOption, postNumber(target))
              }
            />
          );
        })}
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
            isWaiting={chat.isWaiting}
            onSend={handleSend}
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

type PostDividerProps = { title: string };

// Where the chat's turns go on to another post of the thread: its name between two lines.
function PostDivider({ title }: PostDividerProps) {
  return (
    <View style={styles.divider}>
      <Divider variant="menuRow" style={styles.dividerLine} />
      <Text variant="hint">{title}</Text>
      <Divider variant="menuRow" style={styles.dividerLine} />
    </View>
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

type ModelNameHeaderProps = HeaderSlots;

// An ai_admin's header: the writing model's name under the title, once it loaded.
function ModelNameHeader(headerProps: ModelNameHeaderProps) {
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  dividerLine: {
    flex: 1,
  },
});
