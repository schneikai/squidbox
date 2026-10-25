import shuffle from '@/utils/shuffle';

/** The models of a round in a fresh random order, labelled Model A, B, … Z, AA, AB, … in that order. */
export default function assignLetters(modelIds) {
  return shuffle(modelIds).map((modelId, index) => ({ modelId, label: `Model ${letterFor(index)}` }));
}

// 0 → A, 25 → Z, 26 → AA, like spreadsheet columns.
function letterFor(index) {
  const letter = String.fromCharCode(65 + (index % 26));
  return index < 26 ? letter : letterFor(Math.floor(index / 26) - 1) + letter;
}
