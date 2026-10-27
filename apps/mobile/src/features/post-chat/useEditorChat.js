import { useEffect, useState } from 'react';

import { closeChatSession, getChatSession, openChatSession } from './chatSession';

/**
 * The editor's assistant chat: opened with the editor and closed with it, told the caption and the
 * assets as they change, and given `setText` for Use. → the chat's id.
 */
export default function useEditorChat({ text, postAssets, setText }) {
  const [sessionId] = useState(() => openChatSession({ kind: 'draft' }));

  useEffect(() => () => closeChatSession(sessionId), [sessionId]);

  useEffect(() => {
    getChatSession(sessionId)?.setDraft({ text, assets: postAssets.map(({ asset }) => asset) });
  }, [sessionId, text, postAssets]);

  useEffect(() => {
    const session = getChatSession(sessionId);
    session?.setTextApplier(setText);
    return () => session?.setTextApplier(null);
  }, [sessionId, setText]);

  return sessionId;
}
