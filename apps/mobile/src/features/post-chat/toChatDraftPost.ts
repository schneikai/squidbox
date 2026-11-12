import type { ChatDraftPost } from './chatSessions';

type PostContent = { text: string; postAssets: readonly { asset: ChatDraftPost['assets'][number] }[] };

/** A post (a saved one, or an editor's card) as the chat takes it, under `key`. */
export default function toChatDraftPost(key: string, { text, postAssets }: PostContent): ChatDraftPost {
  return { key, text, assets: postAssets.map(({ asset }) => asset) };
}
