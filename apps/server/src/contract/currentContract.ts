import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { apiErrorSchema } from '@squidbox/shared';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import type { RouteOptions } from 'fastify';
import { z } from 'zod';
import { BODY_LIMIT, buildApp } from '../app.js';
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
 * shipped with. The oldest supported build's is kept in contract/baseline.json (written by
 * `npm run contract:raise`), checked by test/contract.test.ts.
 */
export type Contract = {
  routes: ContractRoute[];
  collections: Record<string, JsonSchema>;
  /** The error envelope. */
  error: JsonSchema;
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

// As zod-to-json-schema wrote them, which the baseline, a build from before Zod 4, holds: what a
// request takes (`io: 'input'`, a field with a default is optional) and every schema in place.
const JSON_SCHEMA_OPTIONS = {
  target: 'draft-7',
  io: 'input',
  unrepresentable: 'any',
  reused: 'inline',
  override: holdBothSidesOfPipe,
} as const satisfies Parameters<typeof z.toJSONSchema>[1];

// A pipe that doesn't transform (`.trim().pipe(textSchema)`) checks a value against both of its
// sides: Zod 4 shows the input side only, so the other is added as an allOf (normalize merges it).
function holdBothSidesOfPipe({ zodSchema, jsonSchema }: { zodSchema: z.core.$ZodType; jsonSchema: JsonSchema }) {
  if (!(zodSchema instanceof z.ZodPipe)) return;
  if (zodSchema.in instanceof z.ZodTransform || zodSchema.out instanceof z.ZodTransform) return;
  // The input side moves into the allOf too, so normalize folds its nullable before the merge.
  const input = { ...jsonSchema };
  for (const keyword of Object.keys(jsonSchema)) delete jsonSchema[keyword];
  jsonSchema.allOf = [input, z.toJSONSchema(zodSchema.out, JSON_SCHEMA_OPTIONS)];
}

/** A zod schema as the contract keeps it; none as `{}`. */
export const jsonSchemaOf = (schema: unknown): JsonSchema =>
  schema ? normalize(z.toJSONSchema(schema as z.ZodType, JSON_SCHEMA_OPTIONS) as JsonSchema) : {};

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
          bodyLimit: route.bodyLimit ?? BODY_LIMIT,
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
  await app.close();
  return {
    routes: routes.sort((a, b) => a.method.localeCompare(b.method) || a.url.localeCompare(b.url)),
    collections: Object.fromEntries(
      Object.entries(serverCollections)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, { schema }]) => [name, jsonSchemaOf(schema)]),
    ),
    error: jsonSchemaOf(apiErrorSchema),
    clientMigrations: clientMigrations(),
  };
}
