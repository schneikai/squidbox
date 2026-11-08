import type { JsonSchema } from './normalize.js';

/** What changed at a path between two normalized schemas (compatibility.ts judges it). */
export type Change = {
  kind:
    | 'type-changed'
    | 'nullable-added'
    | 'nullable-removed'
    | 'property-added'
    | 'property-removed'
    | 'required-added'
    | 'required-removed'
    | 'enum-added'
    | 'enum-removed'
    | 'limit-tightened'
    | 'limit-loosened'
    | 'pattern-changed'
    | 'format-changed'
    | 'union-changed'
    | 'unsupported';
  path: string;
  /** For property-added and property-removed: whether the property is (or was) required. */
  required?: boolean;
  detail: string;
};

const LOWER_BOUNDS = ['minLength', 'minimum', 'exclusiveMinimum', 'minItems'];
const UPPER_BOUNDS = ['maxLength', 'maximum', 'exclusiveMaximum', 'maxItems'];
// The keywords this walk reads; any other that differs is `unsupported`.
const KNOWN = new Set([
  'type',
  'properties',
  'required',
  'enum',
  'open',
  'patterns',
  'format',
  'anyOf',
  'items',
  'additionalProperties',
  ...LOWER_BOUNDS,
  ...UPPER_BOUNDS,
]);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isSchema = (value: unknown): value is JsonSchema =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const show = (value: unknown) => (value === undefined ? 'none' : JSON.stringify(value));

// The type list without `null`, `integer` counted as `number` (its narrowing is a limit).
function types(schema: JsonSchema): { base: string[]; nullable: boolean; integer: boolean } {
  const list = [schema.type ?? []].flat() as string[];
  return {
    base: [
      ...new Set(list.filter((type) => type !== 'null').map((type) => (type === 'integer' ? 'number' : type))),
    ].sort(),
    nullable: list.includes('null'),
    integer: list.includes('integer'),
  };
}

/**
 * What changed from `before` to `after` (normalized, normalize.ts), at `path` and below, without
 * judging it: the policies in compatibility.ts do. A keyword this walk doesn't read is `unsupported`
 * when it differs, so nothing it can't read passes as unchanged.
 */
export function schemaChanges(before: JsonSchema, after: JsonSchema, path: string): Change[] {
  const changes: Change[] = [];
  const add = (kind: Change['kind'], detail: string) => changes.push({ kind, path, detail });

  for (const keyword of new Set([...Object.keys(before), ...Object.keys(after)]))
    if (!KNOWN.has(keyword) && !same(before[keyword], after[keyword]))
      add('unsupported', `${keyword} ${show(before[keyword])} → ${show(after[keyword])}`);

  const was = types(before);
  const is = types(after);
  if (!same(was.base, is.base)) add('type-changed', `type ${show(before.type)} → ${show(after.type)}`);
  else if (was.integer !== is.integer)
    add(is.integer ? 'limit-tightened' : 'limit-loosened', `integer → ${is.integer ? 'yes' : 'no'}`);
  if (!was.nullable && is.nullable) add('nullable-added', 'null allowed');
  if (was.nullable && !is.nullable) add('nullable-removed', 'null no longer allowed');

  enumChanges(before, after, add);

  for (const keyword of [...LOWER_BOUNDS, ...UPPER_BOUNDS]) {
    const from = before[keyword] as number | undefined;
    const to = after[keyword] as number | undefined;
    if (from === to) continue;
    const lower = LOWER_BOUNDS.includes(keyword);
    // A bound added, or moved towards the other side, takes values away.
    const tightened = from === undefined || (to !== undefined && (lower ? to > from : to < from));
    add(tightened ? 'limit-tightened' : 'limit-loosened', `${keyword} ${show(from)} → ${show(to)}`);
  }
  if (!same(before.patterns, after.patterns))
    add('pattern-changed', `pattern ${show(before.patterns)} → ${show(after.patterns)}`);
  if (before.format !== after.format) add('format-changed', `format ${show(before.format)} → ${show(after.format)}`);

  changes.push(...propertyChanges(before, after, path));

  for (const [keyword, suffix] of [
    ['items', '[]'],
    ['additionalProperties', '{}'],
  ] as const) {
    const from = before[keyword];
    const to = after[keyword];
    if (isSchema(from) && isSchema(to)) changes.push(...schemaChanges(from, to, `${path}${suffix}`));
    else if (!same(from, to)) add('unsupported', `${keyword} ${show(from)} → ${show(to)}`);
  }

  const fromBranches = before.anyOf as JsonSchema[] | undefined;
  const toBranches = after.anyOf as JsonSchema[] | undefined;
  if (fromBranches && toBranches && fromBranches.length === toBranches.length)
    fromBranches.forEach((branch, index) =>
      changes.push(...schemaChanges(branch, toBranches[index]!, `${path}|${index}`)),
    );
  else if (fromBranches || toBranches)
    add('union-changed', `union of ${fromBranches?.length ?? 0} → ${toBranches?.length ?? 0} branches`);

  return changes;
}

// Values the enum lets through that it didn't (enum-added), and the reverse (enum-removed). No enum
// lets every value through; an open enum (openEnum) lets every value through to its reader, so
// nothing is added to it.
function enumChanges(before: JsonSchema, after: JsonSchema, add: (kind: Change['kind'], detail: string) => void) {
  const from = before.enum as unknown[] | undefined;
  const to = after.enum as unknown[] | undefined;
  if (!from && !to) return;
  const keys = (values: unknown[] | undefined) => new Set((values ?? []).map((value) => JSON.stringify(value)));
  const fromKeys = keys(from);
  const toKeys = keys(to);
  if (from && !before.open) {
    const added = to ? [...toKeys].filter((key) => !fromKeys.has(key)) : ['any value'];
    if (after.open && to) added.push('any value');
    if (added.length > 0) add('enum-added', `enum + ${added.join(', ')}`);
  }
  if (to) {
    const removed = from ? [...fromKeys].filter((key) => !toKeys.has(key)) : ['every other value'];
    if (removed.length > 0) add('enum-removed', `enum − ${removed.join(', ')}`);
  }
}

function propertyChanges(before: JsonSchema, after: JsonSchema, path: string): Change[] {
  const from = (before.properties ?? {}) as Record<string, JsonSchema>;
  const to = (after.properties ?? {}) as Record<string, JsonSchema>;
  const wasRequired = new Set((before.required ?? []) as string[]);
  const isRequired = new Set((after.required ?? []) as string[]);
  const changes: Change[] = [];
  for (const name of new Set([...Object.keys(from), ...Object.keys(to)])) {
    const at = `${path}.${name}`;
    if (!(name in to))
      changes.push({ kind: 'property-removed', path: at, required: wasRequired.has(name), detail: 'removed' });
    else if (!(name in from))
      changes.push({ kind: 'property-added', path: at, required: isRequired.has(name), detail: 'added' });
    else {
      if (!wasRequired.has(name) && isRequired.has(name))
        changes.push({ kind: 'required-added', path: at, detail: 'now required' });
      if (wasRequired.has(name) && !isRequired.has(name))
        changes.push({ kind: 'required-removed', path: at, detail: 'now optional' });
      changes.push(...schemaChanges(from[name]!, to[name]!, at));
    }
  }
  return changes;
}
