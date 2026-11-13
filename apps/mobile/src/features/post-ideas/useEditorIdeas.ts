import type { ChatSubjectKind, IdeasKind } from '@squidbox/shared';
import { useEffect, useRef } from 'react';

import ideasTurns from './ideasTurns';
import shouldStartIdeas from './shouldStartIdeas';
import useIdeaSettings from './useIdeaSettings';

import type { ChatDraftPost } from '@/features/post-chat/chatSessions';
import useChatSends from '@/features/post-chat/useChatSends';
import useSubjectChat from '@/features/post-chat/useSubjectChat';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import { useFirstSyncDone } from '@/sync/useSyncStatus';

type EditorIdeasOptions = {
  kind: Extract<ChatSubjectKind, 'draft' | 'edit'>;
  ideas: IdeasKind;
  posts: ChatDraftPost[];
  activeKey: string;
  setText: (key: string, text: string) => void;
  startsOnItsOwn?: boolean;
};

/**
 * A post editor screen's one assistant chat for all its posts (useSubjectChat) and its ideas starting
 * on their own (shouldStartIdeas, unless not `startsOnItsOwn`: a channel's step): once per screen, as the first post's turn, with the user's prompt of
 * the kind `ideas`; the chat tags the photos first. It sends without watching the chat (useChatSends),
 * so the editor doesn't render with each change of it: its trays do (IdeasTray). → the chat's id
 * (null until open) and the user's ideas `settings`, for the trays.
 */
export default function useEditorIdeas({
  kind,
  ideas,
  posts,
  activeKey,
  setText,
  startsOnItsOwn = true,
}: EditorIdeasOptions) {
  const sessionId = useSubjectChat({ kind, posts, activeKey, setText });
  const { send } = useChatSends(sessionId);
  const settings = useIdeaSettings();
  const isAvailable = useIsAssistantAvailable();
  const isFirstSyncDone = useFirstSyncDone();
  const hasStartedRef = useRef(false);
  const firstKey = posts[0]?.key;
  const hasMedia = (posts[0]?.assets.length ?? 0) > 0;
  const setting = settings?.[ideas];

  useEffect(() => {
    if (!startsOnItsOwn || hasStartedRef.current || firstKey === undefined || setting === undefined) return;
    const isStarting = shouldStartIdeas({
      kind,
      ideas,
      isOn: setting.isOn,
      hasMedia,
      hasStarted: false,
      isAvailable,
      isFirstSyncDone: isFirstSyncDone === true,
    });
    if (isStarting && send(ideasTurns.ideas(ideas, setting, firstKey))) hasStartedRef.current = true;
  }, [startsOnItsOwn, firstKey, setting, kind, ideas, hasMedia, isAvailable, isFirstSyncDone, send]);

  return { sessionId, settings };
}
