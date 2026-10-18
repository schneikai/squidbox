import { collectionsByName, widenToGroups, type FieldClocks } from '@squidbox/shared';

type Versioned = Record<string, unknown> & { updatedAt: number };

/**
 * `base` with `top`'s values of these fields, and the newer `updatedAt` of the two, so this device's
 * next edit gets a clock above both (sync-design §5, §8). The fields are widened to their field
 * groups, so a group (a deletion and its purge, the file flags) never mixes the two sides; and a purge
 * is final, so a purged `base` keeps its deletion group over a `top` that doesn't have the purge.
 */
export function overlayFields<R extends Versioned>(
  collection: string,
  base: R,
  top: Versioned,
  fields: FieldClocks,
): R {
  const descriptor = collectionsByName[collection]!;
  const final = descriptor.finalField;
  const finalGroup = final ? (descriptor.fieldGroups.find((group) => group.includes(final)) ?? [final]) : [];
  const keepsPurge = final !== undefined && base[final] != null && top[final] == null;
  const overlaid = Object.keys(widenToGroups(descriptor, fields)).filter(
    (field) => field in top && !(keepsPurge && finalGroup.includes(field)),
  );
  const values = Object.fromEntries(overlaid.map((field) => [field, top[field]]));
  return { ...base, ...values, updatedAt: Math.max(base.updatedAt, top.updatedAt) };
}
