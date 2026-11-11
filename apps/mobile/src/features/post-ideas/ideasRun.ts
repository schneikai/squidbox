import { type ChatMessage, isReply } from '@/features/post-chat/chatSessions';

/**
 * One item of a run's carousel: the option `index` of the reply `replyId`, or with `index` null a
 * reply's text alone (the assistant answered without options).
 */
export type IdeaItem = { replyId: string; index: number | null; text: string };

/**
 * What the tray shows for one post: `name` and `prompt`, the label and content of the turn that
 * started the run; `isOwnIdeas`, whether that was the post's own ideas prompt (Post ideas, Repost
 * ideas) rather than a prompt button; `items`, the options of its replies in order; `isWriting`,
 * while its last reply is written; `error`, its last reply's failure, if any, with `canRetry` when
 * that reply is the chat's last (Retry asks again for the last reply only).
 */
export type IdeasRun = {
  name: string;
  prompt: string;
  isOwnIdeas: boolean;
  items: IdeaItem[];
  isWriting: boolean;
  error: { message: string | null; canRetry: boolean } | null;
};

/**
 * The run of the post `target` in the chat's `messages`: it starts at the post's last turn the tray
 * started (an `ideas` or `prompt` turn) after the message `closedAt` (Back on the tray; none, or one
 * no longer in the chat, is the chat's start), and holds every later turn for the post (More, and
 * what the user does in the chat). Null without one: the tray shows its prompt buttons.
 */
export default function ideasRun(
  messages: readonly ChatMessage[],
  target: string,
  closedAt: string | null,
): IdeasRun | null {
  const from = closedAt === null ? 0 : messages.findIndex((message) => message.id === closedAt) + 1;
  const start = messages.findLastIndex(
    (message, index) =>
      index >= from &&
      message.role === 'user' &&
      message.target === target &&
      (message.kind === 'ideas' || message.kind === 'prompt'),
  );
  const first = messages[start];
  if (!first || first.role !== 'user') return null;

  const items: IdeaItem[] = [];
  let last: ChatMessage | undefined;
  messages.forEach((message, index) => {
    if (index < start || message.role !== 'user' || message.target !== target) return;
    const reply = messages[index + 1];
    if (!isReply(reply)) return;
    last = reply;
    if (reply.status !== 'done') return;
    if (reply.postOptions.length > 0) {
      reply.postOptions.forEach((text, optionIndex) => items.push({ replyId: reply.id, index: optionIndex, text }));
    } else if (reply.reply) {
      items.push({ replyId: reply.id, index: null, text: reply.reply });
    }
  });
  const lastReply = isReply(last) ? last : null;

  return {
    name: first.label ?? '',
    prompt: first.content,
    isOwnIdeas: first.kind === 'ideas',
    items,
    isWriting: lastReply?.status === 'loading',
    error:
      lastReply?.status === 'error'
        ? { message: lastReply.error, canRetry: lastReply === messages[messages.length - 1] }
        : null,
  };
}
