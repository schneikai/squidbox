import type { IdeasKind, IdeasSetting, NewPromptButton } from '@squidbox/shared';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import IdeasCarousel from './IdeasCarousel';
import SeesLine from './SeesLine';
import ideasRun from './ideasRun';
import ideasText from './ideasText';
import ideasTurns from './ideasTurns';

import AssistantTray from '@/components/AssistantTray';
import Chip from '@/components/Chip';
import type { ChatParams } from '@/features/post-chat/PostChatScreen';
import { canUseFor } from '@/features/post-chat/chatSessions';
import promptSeed from '@/features/post-chat/promptSeed';
import useChatSends from '@/features/post-chat/useChatSends';
import useChatSession, { type LiveChat } from '@/features/post-chat/useChatSession';
import PromptButtonRow from '@/features/prompt-buttons/PromptButtonRow';
import usePromptButtons from '@/features/prompt-buttons/usePromptButtons';
import useHaptics from '@/hooks/useHaptics';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import useSeedPromptButtons from '@/hooks/useSeedPromptButtons';

const WRITE_WITH_AI = 'Write with AI';

type IdeasTrayProps = {
  sessionId: string | null;
  target: string;
  // The post's own ideas (the lead chip), or null for a post of the thread.
  ideas: IdeasKind | null;
  // The user's ideas settings (useIdeaSettings'; undefined while reading).
  settings: Record<IdeasKind, IdeasSetting> | undefined;
  style?: StyleProp<ViewStyle>;
};

/**
 * The assistant's tray for one post (`target`, of the chat `sessionId`), for an account with the
 * assistant, Chat always at its end (the chat with every turn so far). Without a run (ideasRun) it
 * offers what to write: "Write with AI" over the post's own ideas (`ideas`: Post ideas or Repost
 * ideas, the lead chip, with the prompt of `settings`) and the prompt buttons, a tap starting a run,
 * all off while a reply is written. With one, its ideas (IdeasCarousel): under "Writing ideas…" while
 * written and "Ideas" for the post's own, or under a back button with the prompt button's name, which
 * returns to the buttons (the chat's closeIdeas), as the post's own do once failed past Retry. A Use folds the
 * run into one row (the chat's fold, per post), as a tap on its title does whenever ideas show; a tap
 * on the row unfolds it, at the idea last used; a new turn
 * for the post unfolds it too; what the assistant goes on (SeesLine, a tap
 * editing it, which writes the run's ideas again with the edit, in place of any being written) under the cards while the tray is open. Only the tray watches the chat, not the screen holding it.
 * style is for layout only.
 */
export default function IdeasTray({ sessionId, ...props }: IdeasTrayProps) {
  const isAvailable = useIsAssistantAvailable();
  const chat = useChatSession(sessionId);
  if (!isAvailable || !chat || sessionId === null) return null;
  return <IdeasTraySection chat={chat} sessionId={sessionId} {...props} />;
}

type IdeasTraySectionProps = Omit<IdeasTrayProps, 'sessionId'> & { chat: LiveChat; sessionId: string };

// The tray itself, once the assistant is available and the chat open.
function IdeasTraySection({ chat, sessionId, target, ideas, settings, style }: IdeasTraySectionProps) {
  const buttons = usePromptButtons();
  const haptics = useHaptics();
  useSeedPromptButtons();
  const { send, retry } = useChatSends(sessionId);
  const { messages, use, closeIdeas, fold } = chat;
  const closedAt = chat.closedAt[target] ?? null;
  const foldedAt = chat.foldedAt[target] ?? null;
  const run = useMemo(() => ideasRun(messages, target, closedAt, foldedAt), [messages, target, closedAt, foldedAt]);

  const handleUse = useCallback(
    (replyId: string, index: number) => {
      use(replyId, index);
      haptics.success();
    },
    [use, haptics],
  );
  const handleMore = useCallback(() => {
    if (run) send(ideasTurns.more(run, target));
  }, [run, send, target]);
  // An edit to the tags or mentions writes the run's ideas again with them, in place of the ones
  // being written.
  const { assets, tagEdits, mentionEdits, editTags, editMentions, cancel } = chat;
  const subject = useMemo(() => {
    const thenWriteAgain =
      <T,>(edit: (change: T) => void) =>
      (change: T) => {
        edit(change);
        if (!run) return;
        // A tray turn being written is replaced; a message the user wrote in the chat is left to finish.
        if (run.isWriting && isTrayTurnWriting(messages)) cancel();
        send(ideasTurns.again(run, target));
      };
    return {
      assets,
      tagEdits,
      mentionEdits,
      editTags: thenWriteAgain(editTags),
      editMentions: thenWriteAgain(editMentions),
    };
  }, [assets, tagEdits, mentionEdits, editTags, editMentions, cancel, messages, run, send, target]);

  const chatButton = (
    <Chip
      variant="raised"
      icon="message-circle"
      label="Chat"
      onPress={() => router.navigate({ pathname: '/chat/[sessionId]', params: { sessionId } satisfies ChatParams })}
    />
  );

  if (!run) {
    const sendButton = (button: NewPromptButton) => send({ ...promptSeed(button), kind: 'prompt', target });
    const lead = ideas && (
      <Chip
        variant="lead"
        icon="sparkle"
        label={ideasText[ideas].name}
        disabled={chat.isSending || !settings}
        onPress={() => settings && send(ideasTurns.ideas(ideas, settings[ideas], target))}
      />
    );
    return (
      <AssistantTray title={WRITE_WITH_AI} trailing={chatButton} style={style}>
        <PromptButtonRow buttons={buttons ?? []} onPress={sendButton} disabled={chat.isSending} lead={lead} />
      </AssistantTray>
    );
  }

  return (
    <AssistantTray
      title={run.isOwnIdeas ? (run.isWriting ? 'Writing ideas…' : 'Ideas') : run.name}
      isWorking={run.isOwnIdeas && run.isWriting}
      back={run.canClose ? { label: `Back to ${WRITE_WITH_AI}`, onPress: () => closeIdeas(target) } : null}
      fold={
        run.items.length > 0 || run.isFolded
          ? {
              isFolded: run.isFolded,
              onToggle: () => fold(target, !run.isFolded),
              foldLabel: 'Hide ideas',
              unfoldHint: 'Shows the ideas',
            }
          : null
      }
      trailing={chatButton}
      footer={<SeesLine chat={subject} />}
      style={style}
    >
      <IdeasCarousel
        run={run}
        onUse={canUseFor(chat, target) ? handleUse : null}
        onMore={handleMore}
        onRetry={retry}
        isBusy={chat.isSending}
      />
    </AssistantTray>
  );
}

// Whether the reply being written answers a turn the tray sent (its ideas, a prompt button, More).
function isTrayTurnWriting(messages: LiveChat['messages']) {
  const turn = messages[messages.length - 2];
  return turn?.role === 'user' && (turn.kind === 'ideas' || turn.kind === 'prompt' || turn.kind === 'more');
}
