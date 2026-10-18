import { collectionsByName } from '@squidbox/shared';

/**
 * These fields, with deletedAt and the collection's final field (a purge) added when either is among
 * them: the two must come from the same side, or a purge and a restore make a live, purged record.
 */
export function withDeletionPair(collection: string, fields: string[]): string[] {
  const { finalField } = collectionsByName[collection]!;
  if (!finalField || !fields.some((field) => field === 'deletedAt' || field === finalField)) return fields;
  return [...new Set([...fields, 'deletedAt', finalField])];
}
