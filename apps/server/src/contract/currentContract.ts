import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { apiErrorSchema } from '@squidbox/shared';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import type { RouteOptions } from 'fastify';
import type { ZodType } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { buildApp } from '../app.js';
import { serverCollections } from '../sync/collections.js';
import { normalize, type JsonSchema } from './normalize.js';

/** A route as an old build calls it: its request schemas, its answers by status and its body limit. */
export type ContractRoute = {
  method: string;
  url: string;
  bodyLimit: number;
  body: JsonSchema;
  params: JsonSchema;
  querystring: JsonSchema;
  response: Record<string, JsonSchema>;
};

/**
 * The API and sync contract an installed build relies on (docs/sync-design.md §15), as normalized
 * JSON Schema: every route, every collection, the error envelope, and the client migrations a build
 * shipped with. Snapshotted per tagged build under contract/builds by `npm run contract:snapshot` (the
 * ios-build skill), checked by test/contract.test.ts.
 */
export type Contract = {
  routes: ContractRoute[];
  collections: Record<string, JsonSchema>;
  /** The error envelope; none in a snapshot of a build from before the shared envelope. */
  error?: JsonSchema;
  clientMigrations: { tag: string; hash: string }[];
};

const mobileMigrations = fileURLToPath(new URL('../../../mobile/src/sync/db/migrations', import.meta.url));

// The client migrations in order, by their tag and the hash drizzle keeps of their SQL.
function clientMigrations(): Contract['clientMigrations'] {
  const journal = JSON.parse(readFileSync(`${mobileMigrations}/meta/_journal.json`, 'utf8')) as {
    entries: { tag: string }[];
  };
  return readMigrationFiles({ migrationsFolder: mobileMigrations }).map((migration, index) => ({
    tag: journal.entries[index]!.tag,
    hash: migration.hash,
  }));
}

/** A zod schema as the contract keeps it; none as `{}`. */
export const jsonSchemaOf = (schema: unknown): JsonSchema =>
  schema
    ? normalize(
        zodToJsonSchema(schema as ZodType, {
          target: 'jsonSchema7',
          $refStrategy: 'none',
          removeAdditionalStrategy: 'strict',
        }) as JsonSchema,
      )
    : {};

// The dev-only routes (registered only with LIBRARY_COPY_EMAIL) are no build's contract.
const DEV_ROUTES = '/api/v1/dev/';

/** Today's contract, from the app as it registers (the env must load: setThrowawayEnv). */
export async function currentContract(): Promise<Contract> {
  const routes: ContractRoute[] = [];
  const app = await buildApp({
    logger: false,
    onRoute: (route: RouteOptions) => {
      const methods = [route.method].flat();
      if (route.url.startsWith(DEV_ROUTES)) return;
      for (const method of methods) {
        if (method === 'HEAD') continue;
        const schema = route.schema ?? {};
        routes.push({
          method,
          url: route.url,
          bodyLimit: route.bodyLimit ?? 0, // filled from the app's default below
          body: jsonSchemaOf(schema.body),
          params: jsonSchemaOf(schema.params),
          querystring: jsonSchemaOf(schema.querystring),
          response: Object.fromEntries(
            Object.entries((schema.response ?? {}) as Record<string, unknown>).map(([status, answer]) => [
              status,
              jsonSchemaOf(answer),
            ]),
          ),
        });
      }
    },
  });
  await app.ready();
  const defaultBodyLimit = app.initialConfig.bodyLimit ?? 0;
  await app.close();
  return {
    routes: routes
      .map((route) => ({ ...route, bodyLimit: route.bodyLimit || defaultBodyLimit }))
      .sort((a, b) => a.method.localeCompare(b.method) || a.url.localeCompare(b.url)),
    collections: Object.fromEntries(
      Object.entries(serverCollections)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, { schema }]) => [name, jsonSchemaOf(schema)]),
    ),
    error: jsonSchemaOf(apiErrorSchema),
    clientMigrations: clientMigrations(),
  };
}
