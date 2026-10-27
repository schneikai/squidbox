// What each kind of instructions (and each app prompt) is called, and what its editor's footnote says.
const instructionText = {
  writing: {
    title: 'Writing',
    description:
      'Before every post the Compare writes; the chat has its own briefing. The reply format (how many posts, JSON) is added by the app.',
  },
  visionTagging: {
    title: 'Photo tags',
    description:
      "How it tags a photo, in Compare and with Tag it or Tag again in a photo's details. The reply format (JSON) is added by the app and can't be changed.",
  },
  writingFormat: {
    title: 'Writing reply format',
    description:
      'Ends every Compare request. {count} is the number of posts. The reply is still read as a JSON object with a "tweets" list.',
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
      'How Writing as you and your Favorites appear in a Compare request: {aboutYou}, {tone}, {contentTags}, {rules} and {favorites}. A line whose placeholder is empty is left out, with a heading ending in ":" just above it.',
  },
  chatContext: {
    title: 'Chat briefing',
    description:
      'The whole system message of the chat: who you are ({aboutYou}, {tone}, {contentTags}, {rules}, {favorites}), the post ({media}, {tags}, {mentions}, {caption}) and how to answer, with {count} options when you ask for posts. A line whose placeholder is empty is left out, with its heading.',
  },
  moreLikeThis: {
    title: 'More like this',
    description: 'What ⋯ → More like this on an option sends, with the option after it.',
  },
};

export default instructionText;
