import { type AssistantChatMessage, type ChatMessage, isReply } from '@/features/post-chat/chatSessions';

/**
 * One item of a run's carousel: the option `index` of the reply `replyId`, or with `index` null a
 * reply's text alone (the assistant answered without options); `isUsed` once Use put it in the post.
 */
export type IdeaItem = { replyId: string; index: number | null; text: string; isUsed: boolean };

/**
 * What the tray shows for one post: `name` and `prompt`, the label and content of the turn that
 * started the run; `isOwnIdeas`, whether that was the post's own ideas prompt (Post ideas, Repost
 * ideas) rather than a prompt button; `items`, the options of its replies in order; `isWriting`,
 * while its last reply is written; `error`, its last reply's failure, if any, with `canRetry` when
 * that reply is the chat's last (Retry asks again for the last reply only); `canClose`, whether Back
 * is offered: always for a prompt button's run, for the post's own ideas only once stuck on a
 * failure Retry can't redo; `isFolded`, while the tray shows the run as one row (folded after a Use,
 * or by a tap on its title, until the next turn for the post).
 */
export type IdeasRun = {
  name: string;
  prompt: string;
  isOwnIdeas: boolean;
  items: IdeaItem[];
  isWriting: boolean;
  error: { message: string | null; canRetry: boolean } | null;
  canClose: boolean;
  isFolded: boolean;
};

/**
 * The run of the post `target` in the chat's `messages`: it starts at the post's last turn the tray
 * started (an `ideas` or `prompt` turn) after the message `closedAt` (Back on the tray; none, or one
 * no longer in the chat, is the chat's start), and holds every later turn for the post (More, and
 * what the user does in the chat). Folded from the message `foldedAt` until a later turn for the
 * post. Null without one: the tray shows its prompt buttons.
 */
export default function ideasRun(
  messages: readonly ChatMessage[],
  target: string,
  closedAt: string | null,
  foldedAt: string | null = null,
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
  let last: AssistantChatMessage | undefined;
  for (let index = start; index < messages.length; index++) {
    const message = messages[index]!;
    const reply = messages[index + 1];
    if (message.role !== 'user' || message.target !== target || !isReply(reply)) continue;
    last = reply;
    if (reply.status !== 'done') continue;
    if (reply.postOptions.length > 0) {
      reply.postOptions.forEach((text, optionIndex) =>
        items.push({ replyId: reply.id, index: optionIndex, text, isUsed: reply.usedOption === optionIndex }),
      );
    } else if (reply.reply) {
      items.push({ replyId: reply.id, index: null, text: reply.reply, isUsed: false });
    }
  }

  const isOwnIdeas = first.kind === 'ideas';
  const foldedFrom = foldedAt === null ? -1 : messages.findIndex((message) => message.id === foldedAt);
  const isFolded =
    foldedFrom >= start &&
    !messages.some((message, index) => index > foldedFrom && message.role === 'user' && message.target === target);
  const error =
    last?.status === 'error' ? { message: last.error, canRetry: last === messages[messages.length - 1] } : null;
  return {
    name: first.label ?? '',
    prompt: first.content,
    isOwnIdeas,
    items,
    isWriting: last?.status === 'loading',
    error,
    canClose: !isOwnIdeas || (error !== null && !error.canRetry),
    isFolded,
  };
}
