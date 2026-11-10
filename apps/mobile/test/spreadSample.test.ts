import { describe, expect, it } from 'vitest';

import spreadSample from '../src/features/album-tags/spreadSample';

const items = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('spreadSample', () => {
  it('takes the first, the last and evenly between', () => {
    expect(spreadSample(items(10), 4)).toEqual([0, 3, 6, 9]);
  });

  it('takes all of them when there are no more than asked for', () => {
    expect(spreadSample(items(3), 4)).toEqual([0, 1, 2]);
  });

  it('takes the first when asked for one', () => {
    expect(spreadSample(items(5), 1)).toEqual([0]);
  });
});
