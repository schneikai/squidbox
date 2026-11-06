// drizzle-kit writes migrations.js beside this file (drizzle.config.ts, driver 'expo') and rewrites
// it on every `drizzle-kit generate`. This is its type: TypeScript resolves `./migrations/migrations`
// here (Metro takes the .js), as what the expo-sqlite migrator takes, so a new migration changes
// nothing here.
import type { migrate } from 'drizzle-orm/expo-sqlite/migrator';

declare const migrations: Parameters<typeof migrate>[1];
export default migrations;
