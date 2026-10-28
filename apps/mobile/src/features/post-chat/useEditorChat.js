import { useEffect, useState } from 'react';

import chatSessions from './chatSessions';

/**
 * The editor's assistant chat about its post (`kind`, chatSubjectKindSchema): opened with the
 * editor and closed with it, told the caption and the assets as they change, and given `setText`
 * for Use. → the chat's id, null until it is open.
 */
export default function useEditorChat({ kind, text, postAssets, setText }) {
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
