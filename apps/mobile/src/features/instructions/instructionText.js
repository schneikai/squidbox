// What each kind of instructions (and each app prompt) is called, and what its editor's footnote says.
const instructionText = {
  writing: {
    title: 'Writing',
    description:
      "Before every post it writes. The reply format (how many posts, JSON) is added by the app and can't be changed.",
  },
  visionTagging: {
    title: 'Photo tags',
    description:
      "How it tags a photo, in Compare now and at upload later. The reply format (JSON) is added by the app and can't be changed.",
  },
  writingFormat: {
    title: 'Writing reply format',
    description:
      'Ends every writing request. {count} is the number of posts. The reply is still read as a JSON object with a "tweets" list.',
  },
  tagsSystem: {
    title: 'Photo tags system message',
    description:
      'Comes first in every photo tags request. The reply is still read as a JSON object with a "tags" list.',
  },
  themesContext: {
    title: 'Content themes',
    description:
      'Follows your Photo tags instructions when Your content has tags. {themes} is them, separated by commas.',
  },
  personaFraming: {
    title: 'Writing as you framing',
    description:
      'How Writing as you and your Favorites appear in every writing request: {aboutYou}, {tone}, {contentTags}, {rules} and {favorites}. A line whose placeholder is empty is left out, with a heading ending in ":" just above it.',
  },
};

export default instructionText;
