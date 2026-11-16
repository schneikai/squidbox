import { describe, expect, it } from 'vitest';

import uuidV5 from '../src/lib/uuidV5';

const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

describe('uuidV5', () => {
  it('gives the uuid v5 of RFC 9562 (A.4) and of the vector the reviewers ran on react-native-uuid', () => {
    expect(uuidV5('www.example.com', DNS)).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2');
    expect(uuidV5('hello.example.com', DNS)).toBe('fdda765f-fc57-5604-a269-52a7df8164ec');
  });
});
