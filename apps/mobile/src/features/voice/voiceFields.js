// The fields of Writing as you, in the screen's order: each one's label, the one-line example an empty field shows, and
// what its ⓘ sheet says, with three examples.
const voiceFields = {
  aboutYou: {
    label: 'About you',
    placeholder: 'e.g. Outdoor photographer. People follow for the light.',
    description: 'Who you are, what you post and who follows you. What do they come for? Where do you post?',
    examples: [
      'I shoot outdoors and post it on Bluesky: hills, forests and quiet roads. People follow for the light and the slow mornings.',
      'Home baker from Leeds, a loaf a day. People come for the crumb shots and stay for the fails.',
      'Weekend cyclist, mostly gravel. Followers are riders who want the routes and the coffee stops.',
    ],
  },
  tone: {
    label: 'Tone',
    placeholder: 'e.g. Short and calm, a little dry.',
    description: 'How your posts sound. Short or long, calm or chatty, emoji or not, and how it changes by platform.',
    examples: [
      'Short and calm. One emoji at most.',
      'Warm and chatty, lots of emoji, talks to followers like friends.',
      'Dry humor. One line on Bluesky, a bit longer on my site.',
    ],
  },
  contentTags: {
    label: 'Your content',
    placeholder: 'e.g. landscape',
    description: 'What your posts show, a word or two each. It uses them to know what fits you.',
    examples: [
      'landscape, hiking, forest, golden hour',
      'baking, sourdough, kitchen, morning',
      'cycling, gravel, routes, coffee',
    ],
  },
  rules: {
    label: 'Rules',
    placeholder: 'e.g. Never use hashtags',
    description: 'What it must always or never do, one rule each. It follows them in every post it writes.',
    examples: ['Never use hashtags', 'Link only in follow-ups', 'Never name the exact spot'],
  },
};

export default voiceFields;
