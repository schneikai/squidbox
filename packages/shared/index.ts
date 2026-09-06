// @squidbox/shared — the contract package shared by the app and the server: Zod schemas +
// inferred TS types for the API wire format and the sync collection descriptors. One source
// of truth, no drift.
//
// Use bare `import { z } from 'zod'` only — never subpaths like `zod/v4`, which break when
// Metro has package `exports` resolution disabled (unstable_enablePackageExports = false).
import { z } from 'zod';

export { z };

// Collection descriptors + registry (the sync engine's source of truth).
export * from './collections/define';
export * from './collections/asset';
export * from './collections/registry';

// Wire contracts shared between the mobile app and the new server.
export * from './contracts/auth';
export * from './contracts/assets';
export * from './contracts/sync';
