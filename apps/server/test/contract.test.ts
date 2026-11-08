import { describe, it, expect, vi } from 'vitest';
import { CONTRACT_VERSION, openEnum } from '@squidbox/shared';
import { z } from 'zod';

vi.mock('../src/db/client.js', () => ({ getDb: () => ({}), closeDb: async () => {} }));

import { problems } from '../src/contract/compatibility.js';
import { currentContract, jsonSchemaOf, type Contract, type ContractRoute } from '../src/contract/currentContract.js';
import { readHistory } from '../src/contract/history.js';
import { normalize } from '../src/contract/normalize.js';

// Every installed build keeps working against today's server (docs/sync-design.md §15): the contract
// it was built with is recorded under contract/history, and today's must not break any kept version.
describe('the recorded contract', () => {
  it('today’s contract is the newest recorded one (else run `npm run contract:record`)', async () => {
    const newest = readHistory().at(-1);
    expect(await currentContract(), 'The contract changed: run `npm run contract:record`').toEqual(newest?.contract);
  });

  it('CONTRACT_VERSION is the newest recorded version', () => {
    expect(CONTRACT_VERSION).toBe(readHistory().at(-1)?.version);
  });

  it('no kept version has a problem with today’s contract', async () => {
    const current = await currentContract();
    for (const { version, contract } of readHistory())
      expect(problems(contract, current), `version ${version}`).toEqual([]);
  });
});

describe('normalize', () => {
  it('merges two patterns into one sorted set', () => {
    const schema = z.string().regex(/^b/).regex(/^a/);
    expect(jsonSchemaOf(schema)).toEqual({ type: 'string', patterns: ['^a', '^b'] });
  });

  it('merges a piped schema into one, the tighter bound winning', () => {
    const schema = z.string().max(10).trim().pipe(z.string().min(1).max(5));
    expect(jsonSchemaOf(schema)).toEqual({ type: 'string', minLength: 1, maxLength: 5 });
  });

  it('reads openEnum as an open enum, nullable too', () => {
    expect(jsonSchemaOf(openEnum(['a', 'b']))).toEqual({ type: 'string', enum: ['a', 'b'], open: true });
    expect(normalize({ anyOf: [{ type: 'string', enum: ['a'] }, { type: 'string' }, { type: 'null' }] })).toEqual({
      type: ['string', 'null'],
      enum: ['a'],
      open: true,
    });
  });
});

// One-route, one-collection contracts to judge a change with.
const route = (over: Partial<ContractRoute> = {}): ContractRoute => ({
  method: 'POST',
  url: '/api/v1/thing',
  bodyLimit: 1000,
  body: {},
  params: {},
  querystring: {},
  response: {},
  ...over,
});
const contract = (over: Partial<Contract> = {}): Contract => ({
  routes: [route()],
  collections: {},
  error: {},
  clientMigrations: [],
  ...over,
});
const body = (schema: z.ZodType) => contract({ routes: [route({ body: jsonSchemaOf(schema) })] });
const answer = (schema: z.ZodType) => contract({ routes: [route({ response: { 200: jsonSchemaOf(schema) } })] });
const collection = (schema: z.ZodType) => contract({ collections: { things: jsonSchemaOf(schema) } });

describe('what an old build sends (a request) must still pass', () => {
  it('an optional field added passes', () => {
    expect(
      problems(body(z.object({ a: z.string() })), body(z.object({ a: z.string(), b: z.string().optional() }))),
    ).toEqual([]);
  });

  it('a required field added fails', () => {
    expect(problems(body(z.object({ a: z.string() })), body(z.object({ a: z.string(), b: z.string() })))).toEqual([
      'POST /api/v1/thing body.b added',
    ]);
  });

  it.each([
    ['maxLength', z.string().max(10), z.string().max(9)],
    ['minLength', z.string().min(1), z.string().min(2)],
    ['maximum', z.number().max(10), z.number().max(9)],
    ['minimum', z.number().min(1), z.number().min(2)],
    ['exclusiveMinimum', z.number(), z.number().positive()],
    ['maxItems', z.array(z.string()).max(3), z.array(z.string()).max(2)],
    ['minItems', z.array(z.string()), z.array(z.string()).min(1)],
    ['integer', z.number(), z.number().int()],
  ])('a tightened %s fails', (_, before, after) => {
    expect(problems(body(z.object({ a: before })), body(z.object({ a: after })))).toHaveLength(1);
  });

  it('a loosened limit passes', () => {
    expect(problems(body(z.object({ a: z.string().max(9) })), body(z.object({ a: z.string().max(10) })))).toEqual([]);
  });

  it('a new pattern fails', () => {
    expect(problems(body(z.object({ a: z.string() })), body(z.object({ a: z.string().regex(/^x/) })))).toEqual([
      'POST /api/v1/thing body.a pattern none → ["^x"]',
    ]);
  });

  it('an enum value removed fails', () => {
    expect(problems(body(z.object({ a: z.enum(['x', 'y']) })), body(z.object({ a: z.enum(['x']) })))).toEqual([
      'POST /api/v1/thing body.a enum − "y"',
    ]);
  });
});

describe('what an old build reads (a response) must still come as it knows it', () => {
  it('a field added passes', () => {
    expect(problems(answer(z.object({ a: z.string() })), answer(z.object({ a: z.string(), b: z.number() })))).toEqual(
      [],
    );
  });

  it('a field removed fails', () => {
    expect(problems(answer(z.object({ a: z.string(), b: z.number() })), answer(z.object({ a: z.string() })))).toEqual([
      'POST /api/v1/thing 200.b removed',
    ]);
  });

  it('a field made nullable fails', () => {
    expect(problems(answer(z.object({ a: z.string() })), answer(z.object({ a: z.string().nullable() })))).toEqual([
      'POST /api/v1/thing 200.a null allowed',
    ]);
  });

  it('an enum value added fails on a closed enum and passes on an open one', () => {
    expect(problems(answer(z.object({ a: z.enum(['x']) })), answer(z.object({ a: z.enum(['x', 'y']) })))).toEqual([
      'POST /api/v1/thing 200.a enum + "y"',
    ]);
    expect(problems(answer(z.object({ a: openEnum(['x']) })), answer(z.object({ a: openEnum(['x', 'y']) })))).toEqual(
      [],
    );
  });
});

describe('a record an old build pushes and pulls (a collection) keeps every field it stores', () => {
  it('an optional field added passes', () => {
    expect(
      problems(
        collection(z.object({ a: z.string() })),
        collection(z.object({ a: z.string(), b: z.string().optional() })),
      ),
    ).toEqual([]);
  });

  it('a field removed fails', () => {
    expect(
      problems(
        collection(z.object({ a: z.string(), b: z.string().optional() })),
        collection(z.object({ a: z.string() })),
      ),
    ).toEqual(['collections.things.b removed']);
  });

  it('a field made nullable fails', () => {
    expect(
      problems(collection(z.object({ a: z.string() })), collection(z.object({ a: z.string().nullable() }))),
    ).toEqual(['collections.things.a null allowed']);
  });

  it('an enum value added fails', () => {
    expect(
      problems(collection(z.object({ a: z.enum(['x']) })), collection(z.object({ a: z.enum(['x', 'y']) }))),
    ).toEqual(['collections.things.a enum + "y"']);
  });
});

describe('the rest of the contract', () => {
  it('a removed route fails', () => {
    expect(problems(contract(), contract({ routes: [] }))).toEqual(['POST /api/v1/thing is gone']);
  });

  it('a shrunk body limit fails', () => {
    expect(problems(contract(), contract({ routes: [route({ bodyLimit: 999 })] }))).toEqual([
      'POST /api/v1/thing bodyLimit 1000 → 999',
    ]);
  });

  const migrations = (...list: [string, string][]) =>
    contract({ clientMigrations: list.map(([tag, hash]) => ({ tag, hash })) });

  it('an edited or removed client migration fails', () => {
    expect(
      problems(migrations(['0000_a', 'h0'], ['0001_b', 'h1']), migrations(['0000_a', 'h0'], ['0001_b', 'h2'])),
    ).toHaveLength(1);
    expect(problems(migrations(['0000_a', 'h0'], ['0001_b', 'h1']), migrations(['0000_a', 'h0']))).toEqual([
      'client migration 0001_b is gone',
    ]);
  });

  it('an appended client migration passes', () => {
    expect(problems(migrations(['0000_a', 'h0']), migrations(['0000_a', 'h0'], ['0001_b', 'h1']))).toEqual([]);
  });

  it('a keyword the check does not read is a problem', () => {
    const before = contract({ collections: { things: { type: 'array' } } });
    const after = contract({ collections: { things: { type: 'array', uniqueItems: true } } });
    expect(problems(before, after)).toEqual(['collections.things uniqueItems none → true']);
  });
});
