import { describe, expect, it, vi } from 'vitest';

import downloadAssetFileAsync from '../src/features/cloud/assets/downloadAssetFileAsync';

// The download is expo-file-system's native one: it reports this progress, then resolves the file.
vi.mock('expo-file-system', () => ({
  Directory: class {
    create() {}
  },
  File: class {
    constructor(readonly uri: string) {}
    static async downloadFileAsync(
      _url: string,
      file: { uri: string },
      { onProgress }: { onProgress: (progress: { bytesWritten: unknown; totalBytes: unknown }) => void },
    ) {
      onProgress({ bytesWritten: BigInt(512), totalBytes: BigInt(2048) });
      return file;
    }
  },
}));

describe('downloadAssetFileAsync', () => {
  it('reports the share done as a number when the native task sends BigInts', async () => {
    const onProgress = vi.fn();
    await downloadAssetFileAsync({ filename: 'a.jpg' }, 'https://cdn.test/a.jpg', 'file:///downloads/a/', {
      onProgress,
      signal: new AbortController().signal,
    });
    expect(onProgress).toHaveBeenCalledWith(0.25);
  });
});
