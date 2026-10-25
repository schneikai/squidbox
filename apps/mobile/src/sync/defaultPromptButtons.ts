import type { NewPromptButton } from './promptButtonsRepository';

const PPV_PROMPT =
  "Write a PPV message for this. Tease what's in it without describing all of it. End with a reason to unlock now.";

// The prompt buttons a library starts with (seeded once, promptButtonsRepository.seedPromptButtons),
// in their order within each placement. The ids are fixed, so two devices that both seed before
// syncing end up with one row each. Every one can be edited or deleted in the app.
const defaultPromptButtons: NewPromptButton[] = [
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
      'Write a follow-up tweet to this post that sends people to my OnlyFans. Tease what they get there. End with the link: [your link].',
  },
  {
    id: '2b851abc-9936-4ac1-8bc9-f3da04b4d0fb',
    placement: 'post',
    name: 'PPV message',
    icon: 'lock',
    prompt: PPV_PROMPT,
  },
  {
    id: 'e39b0935-7e63-4fd9-8e69-a2011c71edce',
    placement: 'newPost',
    name: 'Caption',
    icon: 'edit',
    prompt: "Write 3 captions for these photos. Short, for X. Mention who's in them when there's a handle for it.",
  },
  {
    id: '8550e694-3323-4fdb-9f97-72463422dfd3',
    placement: 'newPost',
    name: 'PPV message',
    icon: 'lock',
    prompt: PPV_PROMPT,
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
    name: 'Spicier',
    icon: null,
    prompt: 'Make each option spicier and more explicit. Same idea, more heat.',
  },
];

export default defaultPromptButtons;
