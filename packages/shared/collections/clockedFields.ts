import type { CollectionDescriptor } from './define';
import { mergeFields } from './mergeFields';

const cache = new WeakMap<CollectionDescriptor, string[]>();

/** The merge fields with a clock of their own: all but the final field, which goes with deletedAt (sync-design §7). Shared: don't mutate. */
export function clockedFields(descriptor: CollectionDescriptor): string[] {
  let fields = cache.get(descriptor);
  if (!fields) {
    fields = mergeFields(descriptor).filter((field) => field !== descriptor.finalField);
    cache.set(descriptor, fields);
  }
  return fields;
}
