import type { FieldClocks } from '../contracts/sync';
import type { CollectionDescriptor } from './define';

/** These field clocks with each field group that has a member among them widened to all its members, at the group's newest clock. */
export function widenToGroups(
  { fieldGroups }: Pick<CollectionDescriptor, 'fieldGroups'>,
  clocks: FieldClocks,
): FieldClocks {
  const widened = { ...clocks };
  for (const group of fieldGroups) {
    const sent = group.filter((field) => field in clocks);
    if (sent.length === 0) continue;
    const clock = Math.max(...sent.map((field) => clocks[field]!));
    for (const field of group) widened[field] = clock;
  }
  return widened;
}
