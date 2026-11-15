import type { ChatDraftPost } from './chatSessions';

type PostContent = Pick<ChatDraftPost, 'text' | 'mentions'> & {
  postAssets: readonly { asset: ChatDraftPost['assets'][number] }[];
};

/** A post (a saved one, or an editor's card) as the chat takes it, under `key`. */
export default function toChatDraftPost(key: string, { text, mentions, postAssets }: PostContent): ChatDraftPost {
  return { key, text, mentions, assets: postAssets.map(({ asset }) => asset) };
}
