// @squidbox/shared — the sync contract package. Real collection descriptors (Zod schemas
// + inferred types) land in later phases. For Phase 0 this is a trivial placeholder whose
// only job is to prove the monorepo wiring: that a runtime VALUE exported from here
// resolves inside the running Metro bundle (see apps/mobile App.js).
//
// Use bare `import { z } from 'zod'` only — never subpaths like `zod/v4`, which break when
// Metro has package `exports` resolution disabled (unstable_enablePackageExports = false).
import { z } from 'zod';

export type CollectionDescriptor<S extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  schema: S;
};

/**
 * Placeholder collection descriptor factory. Returns its input typed; later phases will
 * expand this into the full descriptor (table name, keys, sync config, etc.).
 */
export function defineCollection<S extends z.ZodTypeAny>(
  name: string,
  schema: S
): CollectionDescriptor<S> {
  return { name, schema };
}

export { z };
