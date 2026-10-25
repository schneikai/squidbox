/** A model's score in its list: thumbs up for writing ("9"), tags that fit for vision ("34 tags fit"). */
export default function scoreText(score, kind) {
  if (!score) return 'Not tried yet';
  if (kind === 'vision') return `${score} ${score === 1 ? 'tag fit' : 'tags fit'}`;
  return String(score);
}
