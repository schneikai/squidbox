import getNewItemId from '@/utils/getNewItemId';

/**
 * A new record of a shared collection (`@squidbox/shared`): `fields` over `defaults` (or over
 * `defaults(record)`, for defaults that follow the base columns), with a new id and the base
 * columns unless `fields` has them. Parsed by the collection's schema, so unknown keys are dropped
 * and a missing or wrong field throws, naming it. Fields left undefined take their default.
 */
export default function newRecord(collection, defaults, fields) {
  const now = Date.now();
  const given = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
  const record = { id: getNewItemId(), createdAt: now, updatedAt: now, deletedAt: null, ...given };
  const fallback = typeof defaults === 'function' ? defaults(record) : defaults;
  const result = collection.schema.safeParse({ ...fallback, ...record });
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid ${collection.name}: ${problems.join('; ')}`);
}
