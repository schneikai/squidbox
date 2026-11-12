import type { PromptButtonRecord } from './promptButton';

/** What a prompt button says and shows: what the editor drafts and an edit changes. */
export type PromptButtonFields = Pick<PromptButtonRecord, 'name' | 'prompt' | 'icon'>;

/** A prompt button's own fields, before it has a position. */
export type NewPromptButton = Pick<PromptButtonRecord, 'id'> & PromptButtonFields;

/**
 * The prompt buttons a library starts with, in their order: the app seeds them once
 * (promptButtonsRepository.seedPromptButtons), and the dev account's mock data starts from them
 * (seed-mock.ts). The ids are fixed, so two devices that both seed before syncing end up with one
 * row each. Every one can be edited or deleted in the app. The post's and the repost's own ideas
 * aren't prompt buttons: they are the user's idea settings (DEFAULT_IDEA_PROMPTS).
 */
export const DEFAULT_PROMPT_BUTTONS: readonly NewPromptButton[] = [
  {
    id: '8550e694-3323-4fdb-9f97-72463422dfd3',
    name: 'Behind the scenes',
    icon: 'image',
    prompt:
      'Write 3 posts about how these photos came about: where and when, and one detail from that day only I would know.',
  },
  {
    id: 'feb830b9-dcfb-401d-8d7b-90b029be4d8d',
    name: 'Shorter',
    icon: 'scissors',
    prompt:
      'Make it shorter: the newest posts in this chat, or my caption when there are none yet. Keep the first line, cut the rest.',
  },
  {
    id: '0ed89837-869a-4bee-85c0-0eccceb8ef89',
    name: 'Funnier',
    icon: 'laugh',
    prompt:
      'Make it a little funnier: the newest posts in this chat, or my caption when there are none yet. Same idea, one light twist.',
  },
  {
    id: 'd4f18d09-e43b-4aeb-a979-8fdcf8cbd7fe',
    name: 'Follow-up with link',
    icon: 'link',
    prompt:
      'Write a short follow-up to this post that sends people to my link. Say in one line what they find there. End with the link: [your link].',
  },
  {
    id: '2b851abc-9936-4ac1-8bc9-f3da04b4d0fb',
    name: 'Thread',
    icon: 'thread',
    prompt:
      'Turn this into a thread of 3 short posts. Open with the strongest line, add one detail each time, and end with a question.',
  },
];

/**
 * Defaults an earlier version seeded and this one retired (Caption and Repost ideas, now the idea
 * settings), with the text they shipped with: seedPromptButtons deletes a library's row that still
 * holds that text, as the server's migration 0038 did, so a library seeded by an older build after
 * the migration loses them too. A row the user edited stays as a button of theirs.
 */
export const RETIRED_PROMPT_BUTTONS: readonly Pick<NewPromptButton, 'id' | 'prompt'>[] = [
  {
    id: 'e39b0935-7e63-4fd9-8e69-a2011c71edce',
    prompt:
      "Write 3 captions for these photos. Short, one line each. Mention who's in them when there's a handle for it.",
  },
  {
    id: '452726e1-35ae-463f-8cab-dcd19bba78df',
    prompt:
      "Write 3 fresh posts that repost this for people who missed it. Same content, a new angle each time. Don't repeat the original wording.",
  },
];
