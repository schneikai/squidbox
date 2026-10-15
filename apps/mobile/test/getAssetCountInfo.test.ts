import { describe, it, expect } from 'vitest';

import getAssetCountInfo from '../src/utils/assets/getAssetCountInfo';

describe('getAssetCountInfo', () => {
  it('names the media type when all are one, else says assets', () => {
    expect(getAssetCountInfo({ photo: 3, video: 0 })).toBe('3 Images');
    expect(getAssetCountInfo({ photo: 0, video: 1 })).toBe('1 Video');
    expect(getAssetCountInfo({ photo: 2, video: 3 })).toBe('5 Assets');
    expect(getAssetCountInfo({ photo: 0, video: 0 })).toBe('0 Assets');
  });
});
