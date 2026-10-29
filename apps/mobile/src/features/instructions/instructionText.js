// What each kind of instructions is called, and what its editor's intro says: where it is used.
const instructionText = {
  writing: {
    title: 'Writing',
    description: 'The system instructions for the assistant when writing posts for you.',
  },
  visionTagging: {
    title: 'Photo tags',
    description: 'The system instructions for the assistant when tagging your photos.',
  },
  moreLikeThis: {
    title: 'More like this',
    description: 'The system instructions for the assistant when you choose More like this.',
  },
  modelCheckJudge: {
    title: 'Verify judge',
    description: 'The system instructions for the judge when Verify judges a reply.',
  },
};

export default instructionText;
