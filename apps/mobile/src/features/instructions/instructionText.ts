import type { InstructionKind } from '@squidbox/shared';

type InstructionText = { title: string; description: string };

// What each kind of instructions is called, and what its editor's intro says: where it is used.
const instructionText: Record<InstructionKind, InstructionText> = {
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
    description: 'The system instructions for the assistant when you choose More like this on an idea.',
  },
  moreIdeas: {
    title: 'More',
    description: 'What the assistant is asked when you tap More after the ideas.',
  },
  modelCheckJudge: {
    title: 'Verify judge',
    description: 'The system instructions for the model that decides if a reply passes Verify.',
  },
  contactScreenshot: {
    title: 'From screenshot',
    description: 'What the assistant is asked when you use From screenshot on a new contact.',
  },
  contactXProfile: {
    title: 'From link',
    description: 'What the assistant is asked about an X profile when you use From link on a new contact.',
  },
};

export default instructionText;
