import { defineConfig } from 'drizzle-kit';

// SQLite for the on-device store. driver:'expo' makes drizzle-kit emit a migrations.js bundle
// (alongside the .sql files) that the expo-sqlite migrator applies on device.
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/sync/db/schema.ts',
  out: './src/sync/db/migrations',
});
