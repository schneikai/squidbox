import { collectionsByName, widenToGroups, type FieldClocks } from '@squidbox/shared';

type Versioned = Record<string, unknown> & { updatedAt: number };

/**
 * `base` with `top`'s values of these fields, and the newer `updatedAt` of the two, so this device's
 * next edit gets a clock above both (sync-design §5, §8). The fields are widened to their field
 * groups, so a group (a deletion and its purge, the file flags) never mixes the two sides. A purged
 * `base` from the server is final, so it keeps its deletion group over a `top` that doesn't have the
 * purge; a caller that already decided between the two (a merge) passes `keepBasePurge: false`.
 */
export function overlayFields<R extends Versioned>(
  collection: string,
  base: R,
  top: Versioned,
  fields: FieldClocks,
  { keepBasePurge = true } = {},
): R {
  const descriptor = collectionsByName[collection]!;
  const final = descriptor.finalField;
  const finalGroup = final ? (descriptor.fieldGroups.find((group) => group.includes(final)) ?? [final]) : [];
  const keepsPurge = keepBasePurge && final !== undefined && base[final] != null && top[final] == null;
  const overlaid = Object.keys(widenToGroups(descriptor, fields)).filter(
    (field) => field in top && !(keepsPurge && finalGroup.includes(field)),
  );
  const values = Object.fromEntries(overlaid.map((field) => [field, top[field]]));
  return { ...base, ...values, updatedAt: Math.max(base.updatedAt, top.updatedAt) };
}
