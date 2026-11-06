import type { AiModelKind } from '@squidbox/shared';

/**
 * What a Verify of `kind` counts: its turns ("turn", "turns", "a reply") or its photos ("photo",
 * "photos", "a photo").
 */
export default function turnUnit(kind: AiModelKind) {
  return kind === 'vision'
    ? { one: 'photo', plural: 'photos', each: 'a photo' }
    : { one: 'turn', plural: 'turns', each: 'a reply' };
}
