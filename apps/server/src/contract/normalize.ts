/** A JSON Schema as the contract keeps it (normalize). */
export type JsonSchema = { [keyword: string]: unknown };

const DROPPED = new Set(['$schema', 'description', 'default']);
const SAFE_BOUNDS: Record<string, number> = {
  minimum: Number.MIN_SAFE_INTEGER,
  maximum: Number.MAX_SAFE_INTEGER,
};
export const LOWER_BOUNDS = ['minLength', 'minimum', 'exclusiveMinimum', 'minItems'];
export const UPPER_BOUNDS = ['maxLength', 'maximum', 'exclusiveMaximum', 'maxItems'];

export const isSchema = (value: unknown): value is JsonSchema =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isNull = (schema: unknown) => isSchema(schema) && schema.type === 'null' && Object.keys(schema).length === 1;

/**
 * Makes Zod's JSON Schema comparable (schemaChanges) and small, and the same as zod-to-json-schema
 * wrote it before Zod 4 (the baseline, a build from before then): no `$schema`, descriptions, defaults,
 * `additionalProperties: true` or `propertyNames: { type: 'string' }`; no safe-integer bounds on an
 * integer, nor a pattern beside `format: 'uuid'`; every `pattern` as a sorted `patterns` set; an `allOf`
 * (two `.regex`, or `.trim().pipe()`) merged into one schema with the tightest bound per side; a
 * nullable as `null` in the `type` list; a `const` as a one-value `enum`. Anything else is left as is, for schemaChanges to refuse.
 */
export function normalize(schema: JsonSchema): JsonSchema {
  let result: JsonSchema = {};
  for (const [keyword, value] of Object.entries(schema)) {
    if (DROPPED.has(keyword)) continue;
    // `true` is what an object without `.strict()` says anyway; `false` (strict) stays, as a change to it
    // decides whether a body with a property the server doesn't know is refused.
    if (keyword === 'additionalProperties' && value === true) continue;
    // A JSON key is a string anyway (a z.record).
    if (keyword === 'propertyNames' && same(value, { type: 'string' })) continue;
    // Zod 4 bounds every `.int()` to the safe integers, which are all a JSON number read in JavaScript holds.
    if (schema.type === 'integer' && SAFE_BOUNDS[keyword] === value) continue;
    // Zod 4 spells out the check `format: 'uuid'` names already.
    if (keyword === 'pattern' && schema.format === 'uuid') continue;
    if (keyword === 'const') result.enum = [value];
    else if (keyword === 'pattern') result.patterns = [value];
    else if (keyword === 'properties' && isSchema(value))
      result.properties = Object.fromEntries(
        Object.entries(value).map(([name, property]) => [name, normalize(property as JsonSchema)]),
      );
    else if ((keyword === 'items' || keyword === 'additionalProperties') && isSchema(value))
      result[keyword] = normalize(value);
    else if (keyword === 'anyOf' || keyword === 'allOf') result[keyword] = (value as JsonSchema[]).map(normalize);
    else result[keyword] = value;
  }
  if (Array.isArray(result.allOf)) {
    const { allOf, ...rest } = result;
    result = (allOf as JsonSchema[]).reduce(merge, rest);
  }
  if (Array.isArray(result.anyOf)) result = foldAnyOf(result);
  return result;
}

// One schema that holds both: types agree, patterns add up, the tighter bound wins. A keyword both
// set to different values that isn't a bound or pattern is kept as an allOf, for schemaChanges to refuse.
function merge(into: JsonSchema, schema: JsonSchema): JsonSchema {
  const merged: JsonSchema = { ...into };
  const unmerged: JsonSchema[] = [];
  for (const [keyword, value] of Object.entries(schema)) {
    const existing = merged[keyword];
    if (existing === undefined || same(existing, value)) merged[keyword] = value;
    else if (keyword === 'patterns')
      merged.patterns = [...new Set([...(existing as string[]), ...(value as string[])])];
    else if (LOWER_BOUNDS.includes(keyword)) merged[keyword] = Math.max(existing as number, value as number);
    else if (UPPER_BOUNDS.includes(keyword)) merged[keyword] = Math.min(existing as number, value as number);
    else unmerged.push({ [keyword]: value });
  }
  if (Array.isArray(merged.patterns)) merged.patterns = [...(merged.patterns as string[])].sort();
  return unmerged.length > 0 ? { ...merged, allOf: [...((merged.allOf as JsonSchema[]) ?? []), ...unmerged] } : merged;
}

// A nullable (`anyOf: [X, { type: 'null' }]`) as X with `null` in its type list.
function foldAnyOf(schema: JsonSchema): JsonSchema {
  const { anyOf, ...rest } = schema;
  const branches = anyOf as JsonSchema[];
  const nullable = branches.some(isNull);
  const others = branches.filter((branch) => !isNull(branch));
  const folded = others.length === 1 ? others[0]! : null;
  if (!folded || (nullable && folded.type === undefined)) return schema;
  const types = [folded.type ?? []].flat() as string[];
  return {
    ...rest,
    ...folded,
    ...(nullable && { type: [...new Set([...types, 'null'])] }),
  };
}
