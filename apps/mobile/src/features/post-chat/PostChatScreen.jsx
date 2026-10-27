import { CHAT_LIMITS, resolveInstructions, uniqueTags } from '@squidbox/shared';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ChatComposer from './ChatComposer';
import ChatSubjectCard from './ChatSubjectCard';
import OptionsMessage from './OptionsMessage';
import RefineRow from './RefineRow';
import UserMessage from './UserMessage';
import { getChatSession } from './chatSession';
import useChatSession from './useChatSession';
import useMentions from './useMentions';

import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import IconMenuButton from '@/components/IconMenuButton';
import IntroText from '@/components/IntroText';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import { SCREEN_PADDING } from '@/constants';
import useAssetTags from '@/features/photo-tags/useAssetTags';
import usePromptButtons from '@/features/prompt-buttons/usePromptButtons';
import useCloseWhen from '@/hooks/useCloseWhen';
import useHaptics from '@/hooks/useHaptics';
import useHasFeature from '@/hooks/useHasFeature';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useLibrary from '@/library/useLibrary';
import { colors, typography } from '@/styles/designTokens';
import { readLiveAssets } from '@/sync/aiStateRepository';
import { getDb, schema } from '@/sync/db/client';
import { readFavorites } from '@/sync/favoritesRepository';
import { readInstructions } from '@/sync/instructionsRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';
import countMediaTypes from '@/utils/assets/countMediaTypes';

const MORE_LIKE_THIS = 'More like this';
const ASK_ANYTHING = 'Ask anything';

/**
 * The assistant chat about the post being written (`{ sessionId }`, the editor's chat; `prompt`, a
 * prompt button's `{ label, content }`, waits in the composer): what it's about (ChatSubjectCard),
 * the user's turns and the assistant's options, the Refine buttons under the last reply, and the
 * composer. A send waits for the photos being tagged, so the options know them. Use puts an option
 * into the caption and goes back to the editor. The chat lasts while the editor is open.
 */
export default function PostChatScreen({ route, navigation }) {
  const { sessionId, prompt } = route.params;
  const isAvailable = useLeaveWhenUnavailable();
  const chat = useChatSession(sessionId);
  useCloseWhen(chat === null);
  const haptics = useHaptics();
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const isAiAdmin = useHasFeature('ai_admin');
  const assets = chat?.draft.assets ?? [];
  const assetIds = assets.map((asset) => asset.id);
  const tagging = useAssetTags(assets);
  const mentions = useMentions(assetIds);
  const groups = usePromptButtons();
  const favorites = useLiveQuery((db) => readFavorites(db), [schema.favorites]);
  const stored = useLiveQuery((db) => readInstructions(db, userId), [schema.instructions], [userId]);
  const [isWaiting, setIsWaiting] = useState(false);
  const scrollRef = useRef(null);
  const shouldScrollRef = useRef(false);
  const keyboard = useAnimatedKeyboard();
  const { bottom: bottomInset } = useSafeAreaInsets();

  const composerStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(bottomInset, keyboard.height.value) + 8,
  }));
  const favoriteIdByText = useMemo(
    () => new Map((favorites ?? []).map((favorite) => [favorite.text, favorite.id])),
    [favorites],
  );
  const messages = chat?.messages ?? [];
  const last = messages[messages.length - 1];
  const instructions = resolveInstructions(stored ?? null, { isAiAdmin });

  // What the chat is about as it is now: the editor's latest caption and assets, the tags stored on
  // them (read after the taggings under way landed) and the handles found in their album's posts.
  async function readContextAsync() {
    const session = getChatSession(sessionId);
    if (!session) return null;
    const { kind, draft } = session.getState();
    const rows = await readLiveAssets(
      getDb(),
      draft.assets.map((asset) => asset.id),
    );
    return {
      kind,
      text: draft.text.slice(0, CHAT_LIMITS.text),
      media: countMediaTypes(draft.assets),
      tags: uniqueTags(rows.flatMap((row) => row.tags ?? [])).slice(0, CHAT_LIMITS.tags),
      mentions: (mentions?.handles ?? [])
        .filter((handle) => handle.length <= CHAT_LIMITS.mention)
        .slice(0, CHAT_LIMITS.mentions),
    };
  }

  // Waits for the photos being tagged, then sends; resolves to whether the turn went.
  async function sendTurn(turn) {
    if (!chat || chat.isSending || isWaiting) return false;
    setIsWaiting(tagging.isTagging);
    try {
      await tagging.taggingAsync();
      const context = await readContextAsync();
      if (!context) return false;
      shouldScrollRef.current = true;
      chat.send(turn, context);
      return true;
    } finally {
      setIsWaiting(false);
    }
  }

  async function handleRetry() {
    const context = await readContextAsync();
    if (!context) return;
    shouldScrollRef.current = true;
    chat.retry(context);
  }

  function handleMoreLikeThis(text) {
    sendTurn({ label: MORE_LIKE_THIS, content: `${instructions.moreLikeThis}\n\n${text}` });
  }

  function handleUse(text) {
    chat.applyText(text);
    haptics.success();
    navigation.goBack();
  }

  function handleContentSizeChange() {
    if (!shouldScrollRef.current) return;
    shouldScrollRef.current = false;
    scrollRef.current?.scrollToEnd({ animated: true });
  }

  function sendButton(button) {
    sendTurn({ label: button.name, content: button.prompt });
  }

  if (!isAvailable || !chat) return null;

  return (
    <ModalSheet>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={() => navigation.goBack()} />}
        centerSlot={
          <View style={styles.title}>
            <Text style={styles.titleText}>Assistant</Text>
            <Text style={styles.subtitle}>Writing as you</Text>
          </View>
        }
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
                <Chip
                  key={button.id}
                  label={button.name}
                  icon={button.icon}
                  variant="outlined"
                  onPress={() => sendButton(button)}
                />
              ))}
            </ChipRow>
          </View>
        )}
        {messages.map((message) =>
          message.role === 'user' ? (
            <UserMessage key={message.id} label={message.label} content={message.content} />
          ) : (
            <OptionsMessage
              key={message.id}
              reply={message}
              source={message.label ?? ASK_ANYTHING}
              favoriteIdByText={favoriteIdByText}
              onRetry={message === last ? handleRetry : null}
              onMoreLikeThis={handleMoreLikeThis}
              onUse={chat.canApply ? handleUse : null}
            />
          ),
        )}
        {last?.role === 'assistant' && last.status === 'done' && (
          <RefineRow
            buttons={groups?.refine ?? []}
            onSend={sendButton}
            onEdit={() => navigation.navigate('PromptButtonsScreen')}
          />
        )}
      </ScrollView>
      <Animated.View style={[styles.composer, composerStyle]}>
        <ChatComposer
          seed={prompt}
          placeholder={messages.length === 0 ? ASK_ANYTHING : 'Tell it what to change'}
          isDisabled={chat.isSending}
          isWaiting={isWaiting}
          onSend={sendTurn}
        />
      </Animated.View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    alignItems: 'center',
  },
  titleText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.footnote,
    color: colors.text.secondary,
  },
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
