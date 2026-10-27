import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ChatComposer from './ChatComposer';
import ChatSubjectCard from './ChatSubjectCard';
import OptionsMessage from './OptionsMessage';
import RefineRow from './RefineRow';
import UserMessage from './UserMessage';
import usePostChat from './usePostChat';

import ChipRow from '@/components/ChipRow';
import IconMenuButton from '@/components/IconMenuButton';
import IntroText from '@/components/IntroText';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import { SCREEN_PADDING } from '@/constants';
import useFavoriteToggle from '@/features/favorites/useFavoriteToggle';
import PromptButtonChip from '@/features/prompt-buttons/PromptButtonChip';
import usePromptButtons from '@/features/prompt-buttons/usePromptButtons';
import useCloseWhen from '@/hooks/useCloseWhen';
import useHaptics from '@/hooks/useHaptics';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';

const ASK_ANYTHING = 'Ask anything';

/**
 * The assistant chat about the post being written (`{ sessionId }`, the editor's chat; `prompt`, a
 * prompt button's `{ label, content }`, waits in the composer): what it's about (ChatSubjectCard),
 * the user's turns and the assistant's options, the Refine buttons under the last reply, and the
 * composer (usePostChat does the sending). Use puts an option into the caption and goes back to the
 * editor. The chat lasts while the editor is open.
 */
export default function PostChatScreen({ route, navigation }) {
  const { sessionId, prompt } = route.params;
  const isAvailable = useLeaveWhenUnavailable();
  const { chat, assets, tagging, mentions, isWaiting, send, sendButton, moreLikeThis, retry } = usePostChat(sessionId);
  useCloseWhen(chat === null);
  const haptics = useHaptics();
  const groups = usePromptButtons();
  const favorites = useFavoriteToggle();
  const scrollRef = useRef(null);
  const shouldScrollRef = useRef(false);
  const keyboard = useAnimatedKeyboard();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const messages = chat?.messages;

  // A new turn or a reply that landed: show the end of the chat once it's laid out.
  useEffect(() => {
    if (messages?.length) shouldScrollRef.current = true;
  }, [messages]);

  const composerStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(bottomInset, keyboard.height.value) + 8,
  }));

  const last = messages?.[messages.length - 1];
  const applyText = chat?.canApply ? chat.applyText : null;

  const handleUse = useCallback(
    (text) => {
      applyText(text);
      haptics.success();
      navigation.goBack();
    },
    [applyText, haptics, navigation],
  );

  function handleContentSizeChange() {
    if (!shouldScrollRef.current) return;
    shouldScrollRef.current = false;
    scrollRef.current?.scrollToEnd({ animated: true });
  }

  if (!isAvailable || !chat) return null;

  return (
    <ModalSheet>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={() => navigation.goBack()} />}
        centerSlot="Assistant"
        subtitle="Writing as you"
        rightSlot={
          <IconMenuButton accessibilityLabel="Chat options">
            <MenuOption label="New chat" icon="edit" onPress={chat.reset} />
            <MenuOption label="Writing as you" icon="user" onPress={() => navigation.navigate('VoiceScreen')} />
            <MenuOption
              label="Prompt buttons"
              icon="prompt-buttons"
              onPress={() => navigation.navigate('PromptButtonsScreen')}
            />
            <MenuOption label="Favorites" icon="heart" onPress={() => navigation.navigate('FavoritesScreen')} />
          </IconMenuButton>
        }
      />
      <ScrollView
        ref={scrollRef}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={handleContentSizeChange}
        contentContainerStyle={styles.content}
      >
        <ChatSubjectCard
          kind={chat.kind}
          assets={assets}
          tagging={tagging}
          mentions={mentions}
          onOpenTags={(assetId) => navigation.navigate('PhotoTagsScreen', { assetId })}
        />
        {messages.length === 0 && (
          <View style={styles.empty}>
            <IntroText>Ask anything about this post, or start from a button.</IntroText>
            <ChipRow>
              {(groups?.newPost ?? []).map((button) => (
                <PromptButtonChip key={button.id} button={button} onPress={sendButton} />
              ))}
            </ChipRow>
          </View>
        )}
        {messages.map((message, index) =>
          message.role === 'user' ? (
            <UserMessage key={message.id} label={message.label} content={message.content} />
          ) : (
            <OptionsMessage
              key={message.id}
              reply={message}
              source={messages[index - 1]?.label ?? ASK_ANYTHING}
              favorites={favorites}
              onRetry={message === last ? retry : null}
              onMoreLikeThis={moreLikeThis}
              onUse={applyText ? handleUse : null}
            />
          ),
        )}
        {last?.role === 'assistant' && last.status === 'done' && (
          <RefineRow buttons={groups?.refine ?? []} onSend={sendButton} />
        )}
      </ScrollView>
      <Animated.View style={[styles.composer, composerStyle]}>
        <ChatComposer
          seed={prompt}
          placeholder={messages.length === 0 ? ASK_ANYTHING : 'Tell it what to change'}
          isDisabled={chat.isSending}
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
  empty: {
    gap: 12,
    paddingTop: 8,
  },
  composer: {
    paddingTop: 8,
    paddingHorizontal: SCREEN_PADDING,
  },
});
