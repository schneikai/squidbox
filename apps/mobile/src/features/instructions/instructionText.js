// What each kind of instructions is called, and what its editor's footnote says.
const instructionText = {
  writing: {
    title: 'Writing',
    description:
      'The whole briefing of the chat and the Compare: who you are ({aboutYou}, {tone}, {contentTags}, {rules}, {favorites}), the post ({media}, {tags}, {mentions}, {caption}; the Compare has none) and how to answer, with {count} options when you ask for posts. A line whose placeholder is empty is left out, and so is a heading with nothing left under it. The reply is still read as a JSON object with "reply" and "postOptions".',
  },
  visionTagging: {
    title: 'Photo tags',
    description:
      'How it tags a photo, in Compare and with Tag it or Tag again in a photo\'s details. {themes} is Your content\'s tags, separated by commas; its line is left out when there are none. The reply is still read as a JSON object with a "tags" list.',
  },
  moreLikeThis: {
    title: 'More like this',
    description: 'What ⋯ → More like this on an option sends, with the option after it.',
  },
};

export default instructionText;
