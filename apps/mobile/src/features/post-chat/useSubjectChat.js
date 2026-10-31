import { useEffect, useState } from 'react';

import chatSessions from './chatSessions';

/**
 * The assistant chat about a post (`kind`, chatSubjectKindSchema): opened with the screen that shows
 * the post (its editor, or a posted post) and closed with it, told the text and the assets as they
 * change, and given `setText` for Use (none for a posted post: its options have Copy). → the chat's
 * id, null until it is open.
 */
export default function useSubjectChat({ kind, text, postAssets, setText = null }) {
  const [sessionId, setSessionId] = useState(null);

  // Opened and closed by one effect, so an effect run again (Fast Refresh) opens a new chat.
  useEffect(() => {
    const id = chatSessions.open({ kind });
    setSessionId(id);
    return () => chatSessions.close(id);
  }, [kind]);

  useEffect(() => {
    chatSessions.get(sessionId)?.setDraft({ text, assets: postAssets.map(({ asset }) => asset) });
  }, [sessionId, text, postAssets]);

  useEffect(() => {
    const session = chatSessions.get(sessionId);
    session?.setTextApplier(setText);
    return () => session?.setTextApplier(null);
  }, [sessionId, setText]);

  return sessionId;
}
