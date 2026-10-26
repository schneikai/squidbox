import type { PromptButtonRecord } from './promptButton';

/** A prompt button's own fields, before it has a position. */
export type NewPromptButton = Pick<PromptButtonRecord, 'id' | 'name' | 'prompt' | 'placement' | 'icon'>;

/**
 * The prompt buttons a library starts with, in their order within each placement: the app seeds them
 * once (promptButtonsRepository.seedPromptButtons), and the dev account's mock data starts from them
 * (seed-mock.ts). The ids are fixed, so two devices that both seed before syncing end up with one
 * row each. Every one can be edited or deleted in the app.
 */
export const DEFAULT_PROMPT_BUTTONS: readonly NewPromptButton[] = [
  {
    id: '452726e1-35ae-463f-8cab-dcd19bba78df',
    placement: 'post',
    name: 'Repost ideas',
    icon: 'repeat',
    prompt:
      "Write 3 fresh posts that repost this for people who missed it. Same content, a new angle each time. Don't repeat the original wording.",
  },
  {
    id: 'd4f18d09-e43b-4aeb-a979-8fdcf8cbd7fe',
    placement: 'post',
    name: 'Follow-up with link',
    icon: 'link',
    prompt:
      'Write a short follow-up to this post that sends people to my link. Say in one line what they find there. End with the link: [your link].',
  },
  {
    id: '2b851abc-9936-4ac1-8bc9-f3da04b4d0fb',
    placement: 'post',
    name: 'Thread',
    icon: 'list',
    prompt:
      'Turn this into a thread of 3 short posts. Open with the strongest line, add one detail each time, and end with a question.',
  },
  {
    id: 'e39b0935-7e63-4fd9-8e69-a2011c71edce',
    placement: 'newPost',
    name: 'Caption',
    icon: 'edit',
    prompt:
      "Write 3 captions for these photos. Short, one line each. Mention who's in them when there's a handle for it.",
  },
  {
    id: '8550e694-3323-4fdb-9f97-72463422dfd3',
    placement: 'newPost',
    name: 'Behind the scenes',
    icon: 'image',
    prompt:
      'Write 3 posts about how these photos came about: where and when, and one detail from that day only I would know.',
  },
  {
    id: '8f23a0a7-7d1c-48e4-985b-f930365d8a63',
    placement: 'refine',
    name: 'Shorter',
    icon: null,
    prompt: 'Make each option shorter. Keep the hook, cut the rest.',
  },
  {
    id: '7d12ff1c-8cc6-4235-8fa3-c94d0cce6d36',
    placement: 'refine',
    name: 'Funnier',
    icon: null,
    prompt: 'Make each option a little funnier. Same idea, one light twist.',
  },
];
