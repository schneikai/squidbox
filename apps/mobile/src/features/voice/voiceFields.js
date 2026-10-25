// The fields of Writing as you: each one's label, the one-line example an empty field shows, and
// what its ⓘ sheet says, with three examples. About you and Tone are the mockups' words.
const voiceFields = {
  aboutYou: {
    label: 'About you',
    placeholder: 'e.g. Gym guy from Berlin. Fans come for the attitude.',
    description: 'Who you are, what you post and who your fans are. What do they come for? Where do you post?',
    examples: [
      '29, gym guy from Berlin, a bit cocky. My fans are mostly guys who come for the gym stuff and stay for the rest.',
      "Couple from Austin, we post together. Fans love that we're real, not a studio.",
      'Cosplayer, mostly anime. Fans are gamers who want the character, not just the outfit.',
    ],
  },
  contentTags: {
    label: 'Your content',
    placeholder: 'e.g. gym',
    description: 'What your posts show, a word or two each. It uses them to know what fits you.',
    examples: ['gym, solo, shower, POV, lingerie', 'couple, outdoor, morning, real', 'cosplay, anime, gaming, wigs'],
  },
  tone: {
    label: 'Tone',
    placeholder: 'e.g. Short and cocky. Teases, never begs.',
    description:
      'How your posts sound. Short or long, sweet or cocky, emoji or not, and how explicit on which platform.',
    examples: [
      'Short. Teases, never begs. One emoji at most.',
      'Sweet and chatty, lots of emoji, calls fans babe.',
      'Dry humor. Explicit on OnlyFans, only hints on X.',
    ],
  },
  useEmoji: {
    label: 'Use emoji',
    description: 'The way you use them in your posts',
  },
  rules: {
    label: 'Rules',
    placeholder: 'e.g. Never use hashtags',
    description: 'What it must always or never do, one rule each. It follows them in every post it writes.',
    examples: ['Never use hashtags', 'OnlyFans link only in follow-ups', 'Never call fans babe'],
  },
  examplePosts: {
    label: 'Example posts',
    placeholder: 'Paste a post',
    description: 'A few of your own posts that sound most like you. It writes like these, word for word your style.',
    examples: [
      "Sheets still warm. You missed it, but the video didn't.",
      "Leg day. You're welcome.",
      'Guess who forgot the towel again 🙈 Full set is up.',
    ],
  },
};

export default voiceFields;
