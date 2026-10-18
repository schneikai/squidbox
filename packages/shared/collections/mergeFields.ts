import type { z } from 'zod';
import type { CollectionDescriptor } from './define';

/** The fields of a collection that merge one by one: every synced field but `id`, `createdAt` and `updatedAt`. */
export function mergeFields(descriptor: CollectionDescriptor): string[] {
  const { shape } = descriptor.schema as z.ZodObject<z.ZodRawShape>;
  return Object.keys(shape).filter((key) => key !== 'id' && key !== 'createdAt' && key !== 'updatedAt');
}
