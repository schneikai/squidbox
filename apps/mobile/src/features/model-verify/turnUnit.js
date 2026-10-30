/**
 * What a Verify of `kind` counts: its turns ("turn", "turns", "a reply") or its photos ("photo",
 * "photos", "a photo").
 */
export default function turnUnit(kind) {
  return kind === 'vision'
    ? { one: 'photo', plural: 'photos', each: 'a photo' }
    : { one: 'turn', plural: 'turns', each: 'a reply' };
}
