import type { z } from 'zod';
import type { CollectionDescriptor } from './define';

const cache = new WeakMap<CollectionDescriptor, string[]>();

/** The fields of a collection that merge one by one: every synced field but `id`, `createdAt` and `updatedAt`. Shared: don't mutate. */
export function mergeFields(descriptor: CollectionDescriptor): string[] {
  let fields = cache.get(descriptor);
  if (!fields) {
    const { shape } = descriptor.schema as z.ZodObject<z.ZodRawShape>;
    fields = Object.keys(shape).filter((key) => key !== 'id' && key !== 'createdAt' && key !== 'updatedAt');
    cache.set(descriptor, fields);
  }
  return fields;
}
