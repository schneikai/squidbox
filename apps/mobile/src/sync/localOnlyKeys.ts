import { collectionsByName } from '@squidbox/shared';

/** The collection's fields that stay on this device (never pushed, never pulled), e.g. syncError. */
export function localOnlyKeys(collection: string): Set<string> {
  return new Set(Object.keys(collectionsByName[collection]?.localOnly ?? {}));
}
