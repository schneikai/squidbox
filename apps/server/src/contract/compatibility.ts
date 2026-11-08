import type { Contract, ContractRoute } from './currentContract.js';
import type { JsonSchema } from './normalize.js';
import { schemaChanges, type Change } from './schemaChanges.js';

type Policy = (change: Change) => boolean;

// What an old build sends, validated by the server: it must still pass. Dropping a property is fine
// (the server strips unknown keys), as are loosening and an optional property added.
const breaksRequest: Policy = ({ kind, required }) =>
  (kind === 'property-added' && required === true) ||
  [
    'required-added',
    'type-changed',
    'nullable-removed',
    'enum-removed',
    'limit-tightened',
    'pattern-changed',
    'format-changed',
    'union-changed',
    'unsupported',
  ].includes(kind);

// What an old build reads, without validating: what it relies on must still come, in a shape and with
// values it knows. Added properties and limit changes are fine.
const breaksResponse: Policy = ({ kind, required }) =>
  (kind === 'property-removed' && required === true) ||
  ['required-removed', 'type-changed', 'nullable-added', 'enum-added', 'union-changed', 'unsupported'].includes(kind);

// A record an old build pushes and pulls: both of the above, and every field it stores stays (an old
// build's NOT NULL column, its closed enums). Only an optional field added and a loosened limit pass.
const breaksCollection: Policy = ({ kind, required }) =>
  !(kind === 'limit-loosened' || (kind === 'property-added' && required === false));

const judge = (policy: Policy, before: JsonSchema, after: JsonSchema, path: string) =>
  schemaChanges(before, after, path)
    .filter(policy)
    .map((change) => `${change.path} ${change.detail}`);

const routeKey = (route: Pick<ContractRoute, 'method' | 'url'>) => `${route.method} ${route.url}`;

/**
 * Why a build that speaks the `recorded` contract can't work against `current`, one sentence per
 * problem with its path; none when it can (docs/sync-design.md §15).
 */
export function problems(recorded: Contract, current: Contract): string[] {
  const found: string[] = [];
  const routes = new Map(current.routes.map((route) => [routeKey(route), route]));
  for (const before of recorded.routes) {
    const key = routeKey(before);
    const after = routes.get(key);
    if (!after) {
      found.push(`${key} is gone`);
      continue;
    }
    if (after.bodyLimit < before.bodyLimit) found.push(`${key} bodyLimit ${before.bodyLimit} → ${after.bodyLimit}`);
    for (const part of ['body', 'params', 'querystring'] as const)
      found.push(...judge(breaksRequest, before[part], after[part], `${key} ${part}`));
    for (const [status, answer] of Object.entries(before.response)) {
      const now = after.response[status];
      if (now) found.push(...judge(breaksResponse, answer, now, `${key} ${status}`));
      else found.push(`${key} no longer answers ${status}`);
    }
  }
  for (const [name, schema] of Object.entries(recorded.collections)) {
    const now = current.collections[name];
    if (now) found.push(...judge(breaksCollection, schema, now, `collections.${name}`));
    else found.push(`collections.${name} is gone`);
  }
  found.push(...judge(breaksResponse, recorded.error, current.error, 'error'));
  recorded.clientMigrations.forEach((migration, index) => {
    const now = current.clientMigrations[index];
    if (!now) found.push(`client migration ${migration.tag} is gone`);
    else if (now.tag !== migration.tag || now.hash !== migration.hash)
      found.push(`client migration ${migration.tag} was edited (now ${now.tag}, hash ${now.hash.slice(0, 12)})`);
  });
  return found;
}
