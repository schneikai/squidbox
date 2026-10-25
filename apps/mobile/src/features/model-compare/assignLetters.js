import shuffle from '@/utils/shuffle';

const LETTERS = ['A', 'B', 'C', 'D'];

/** The models of a round in a fresh random order, labelled Model A, B, C, D in that order. */
export default function assignLetters(modelIds) {
  return shuffle(modelIds).map((modelId, index) => ({ modelId, label: `Model ${LETTERS[index]}` }));
}
