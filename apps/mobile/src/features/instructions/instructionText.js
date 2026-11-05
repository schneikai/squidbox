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
    description: 'The system instructions for the assistant when you choose More like this on a post suggestion.',
  },
  modelCheckJudge: {
    title: 'Verify judge',
    description: 'The system instructions for the model that decides if a reply passes Verify.',
  },
  contactScreenshot: {
    title: 'Get info from screenshot',
    description: 'What the assistant is asked when you use Get info from screenshot on a new contact.',
  },
};

export default instructionText;
