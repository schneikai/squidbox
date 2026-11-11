import type { IdeasKind } from '@squidbox/shared';
import { useEffect, useRef } from 'react';

import ideasTurns from './ideasTurns';
import shouldStartIdeas from './shouldStartIdeas';
import useIdeaSettings from './useIdeaSettings';
import usePostIdeas from './usePostIdeas';

import type { ChatDraftPost } from '@/features/post-chat/chatSessions';
import useSubjectChat from '@/features/post-chat/useSubjectChat';
import type { PostEditorKind } from '@/features/posts/PostEditor';
import useIsAssistantAvailable from '@/hooks/useIsAssistantAvailable';
import { useFirstSyncDone } from '@/sync/useSyncStatus';

type EditorIdeasOptions = {
  kind: PostEditorKind;
  ideas: IdeasKind;
  posts: ChatDraftPost[];
  activeKey: string;
  setText: (key: string, text: string) => void;
};

/**
 * The post editor's one assistant chat for all its posts (useSubjectChat), what its trays share
 * (usePostIdeas), and its ideas starting on their own (shouldStartIdeas): once per sheet, as the
 * first post's turn, with the user's prompt of the kind `ideas`; the chat tags the photos first.
 */
export default function useEditorIdeas({ kind, ideas, posts, activeKey, setText }: EditorIdeasOptions) {
  const sessionId = useSubjectChat({ kind, posts, activeKey, setText });
  const postIdeas = usePostIdeas(sessionId);
  const settings = useIdeaSettings();
  const isAvailable = useIsAssistantAvailable();
  const isFirstSyncDone = useFirstSyncDone();
  const hasStartedRef = useRef(false);
  const first = posts[0];
  const hasMedia = (first?.assets.length ?? 0) > 0;
  const { send, chat } = postIdeas;
  const isOpen = chat !== null;

  useEffect(() => {
    const isStarting =
      isOpen &&
      first !== undefined &&
      settings !== undefined &&
      shouldStartIdeas({
        kind,
        ideas,
        isOn: settings[ideas].isOn,
        hasMedia,
        hasStarted: hasStartedRef.current,
        isAvailable,
        isFirstSyncDone: isFirstSyncDone === true,
      });
    if (isStarting && send(ideasTurns.ideas(ideas, settings[ideas], first.key))) hasStartedRef.current = true;
  }, [isOpen, first, settings, kind, ideas, hasMedia, isAvailable, isFirstSyncDone, send]);

  return postIdeas;
}
