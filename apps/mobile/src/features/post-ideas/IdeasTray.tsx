import type { IdeasKind, NewPromptButton } from '@squidbox/shared';
import { router } from 'expo-router';
import { useCallback } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import IdeasCarousel from './IdeasCarousel';
import SeesLine from './SeesLine';
import ideasRun from './ideasRun';
import ideasText from './ideasText';
import ideasTurns from './ideasTurns';
import useIdeaSettings from './useIdeaSettings';
import type { PostIdeas } from './usePostIdeas';

import AssistantTray from '@/components/AssistantTray';
import Chip from '@/components/Chip';
import type { ChatParams } from '@/features/post-chat/PostChatScreen';
import { canUseFor } from '@/features/post-chat/chatSessions';
import promptTurn from '@/features/post-chat/promptTurn';
import PromptButtonRow from '@/features/prompt-buttons/PromptButtonRow';
import usePromptButtons from '@/features/prompt-buttons/usePromptButtons';
import useHaptics from '@/hooks/useHaptics';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import useSeedPromptButtons from '@/hooks/useSeedPromptButtons';

const WRITE_WITH_AI = 'Write with AI';

type IdeasTrayProps = {
  postIdeas: PostIdeas;
  target: string;
  // The post's own ideas (the lead chip), or null for a post of the thread.
  ideas: IdeasKind | null;
  style?: StyleProp<ViewStyle>;
};

/**
 * The assistant's tray for one post (`target`, of the chat `postIdeas`), for an account with the
 * assistant, Chat always at its end (the chat with every turn so far). Without a run (ideasRun) it
 * offers what to write: "Write with AI" over the post's own ideas (`ideas`: Post ideas or Repost
 * ideas, the lead chip) and the prompt buttons, a tap starting a run, all off while a reply is
 * written. With one, its ideas (IdeasCarousel): under "Writing ideas…" while written and "Ideas" for
 * the post's own, or under a back button with the prompt button's name, which returns to the
 * buttons; what the assistant goes on (SeesLine) under the cards while the first are written.
 * style is for layout only.
 */
export default function IdeasTray(props: IdeasTrayProps) {
  const isAvailable = useIsAssistantAvailable();
  if (!isAvailable || !props.postIdeas.chat) return null;
  return <IdeasTraySection {...props} />;
}

// The tray itself, once the assistant is available and the chat open.
function IdeasTraySection({ postIdeas, target, ideas, style }: IdeasTrayProps) {
  const buttons = usePromptButtons();
  const settings = useIdeaSettings();
  const haptics = useHaptics();
  useSeedPromptButtons();
  const { chat, send, retry, sessionId, closedAt, closeIdeas, tagging, mentions } = postIdeas;
  const use = chat?.use;

  const handleUse = useCallback(
    (replyId: string, index: number) => {
      use?.(replyId, index);
      haptics.success();
    },
    [use, haptics],
  );

  if (!chat || sessionId === null) return null;

  const run = ideasRun(chat.messages, target, closedAt[target] ?? null);
  const chatButton = (
    <Chip
      variant="raised"
      icon="message-circle"
      label="Chat"
      onPress={() => router.navigate({ pathname: '/chat/[sessionId]', params: { sessionId } satisfies ChatParams })}
    />
  );

  if (!run) {
    const sendButton = (button: NewPromptButton) => send(promptTurn(button, target));
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

  const isFirstWriting = run.isWriting && run.items.length === 0;
  return (
    <AssistantTray
      title={run.isOwnIdeas ? (run.isWriting ? 'Writing ideas…' : 'Ideas') : run.name}
      isWorking={run.isOwnIdeas && run.isWriting}
      onBack={run.isOwnIdeas ? null : () => closeIdeas(target)}
      backLabel={`Back to ${WRITE_WITH_AI}`}
      trailing={chatButton}
      footer={isFirstWriting && <SeesLine tagging={tagging} mentions={mentions} tagEdits={chat.tagEdits} />}
      style={style}
    >
      <IdeasCarousel
        run={run}
        onUse={canUseFor(chat, target) ? handleUse : null}
        onMore={() => send(ideasTurns.more(run, target))}
        onRetry={retry}
        isBusy={chat.isSending}
      />
    </AssistantTray>
  );
}
