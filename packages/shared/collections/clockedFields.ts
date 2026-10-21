import type { CollectionDescriptor } from './define';
import { mergeFields } from './mergeFields';

/** The merge fields with a clock of their own: all but the final field, which goes with deletedAt (sync-design §7). */
export function clockedFields(descriptor: CollectionDescriptor): string[] {
  return mergeFields(descriptor).filter((field) => field !== descriptor.finalField);
}
