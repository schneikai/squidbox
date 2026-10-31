// The mock account's creator, shared by scripts/seed-mock.ts (his Writing as you) and
// Verify (chatVerify.ts and tagVerify.ts brief each model with him): a guy who posts his
// outdoor photos on Bluesky, one line each, at most one emoji, at the end.

// His Bluesky profile (made up), where Follow-up with link sends people.
export const PROFILE_LINK = 'https://bsky.app/profile/quietroads.bsky.social';

// Writing as you.
export const MOCK_PERSONA = {
  aboutYou:
    "I'm a guy who shoots outdoors and posts it on Bluesky: hills, forests, quiet coast and the roads between them. People follow for the light and the slow mornings, and the odd story from the trip.",
  tone: 'Short and calm, a little dry. One line, never salesy. At most one emoji, at the end.',
  contentTags: ['landscape', 'hiking', 'forest', 'golden hour', 'road trip', 'coast', 'film look'],
  rules: [
    'Never use hashtags',
    'No exclamation marks',
    'Never name the exact spot, only the region',
    'Keep each post well under 300 characters',
  ],
};

// Posts he wrote, as the writing prompts quote them (readSamplePosts).
export const MOCK_POSTS: string[] = [
  "Up before the sun again. The hills don't wait, and neither does the light.",
  'Golden hour on the ridge. Stayed until it was gone 🌅',
  'Three days, one tent, zero signal. Best weekend this year 🌲',
  `The rest of the coast trip is on my profile. The last one is the photo I almost didn't post. ${PROFILE_LINK}`,
  "Coffee on a cold rock tastes better. I don't make the rules.",
  'Some trails you hike for the view. This one was for the quiet.',
  'Packed for rain, got a sunburn. Classic.',
];
