import { describe, expect, it, vi } from 'vitest';

import UpdateRequiredError from '../src/utils/cloud-api/UpdateRequiredError';
import uploadFileAsync from '../src/utils/cloud-api/assets/uploadFileAsync';
import { updateRequiredStore } from '../src/utils/cloud-api/updateRequiredStore';

// The upload task is expo-file-system's native one: it reports the progress and resolves the
// response it is given here.
type Progress = { bytesSent: unknown; totalBytes: unknown };
const upload = vi.hoisted(() => ({
  result: undefined as { status: number; body: string } | undefined,
  progress: [] as Progress[],
}));
vi.mock('expo-file-system', () => ({
  UploadType: { BINARY_CONTENT: 0 },
  File: class {
    createUploadTask(_url: string, options: { onProgress?: (progress: Progress) => void }) {
      return {
        uploadAsync: async () => {
          for (const progress of upload.progress) options.onProgress?.(progress);
          return upload.result;
        },
      };
    }
  },
}));
// expo-constants, which the header reads, needs React Native.
vi.mock('../src/utils/cloud-api/clientHeader', () => ({ clientHeader: () => ({}) }));
vi.mock('../src/utils/cloud-api/apiBaseUrl', () => ({ API_BASE_URL: 'https://api.test/api/v1' }));
vi.mock('../src/utils/cloud-api/requireSession', () => ({
  default: () => ({ tokens: { accessToken: 'access', refreshToken: 'refresh' } }),
}));
vi.mock('../src/utils/cloud-api/authentication/refreshAccessTokenAsync', () => ({ default: async () => 'access' }));

const identity = { serverId: 'server', userId: 'user' };

describe('uploadFileAsync', () => {
  it("rejects with the server's error message when the upload fails", async () => {
    upload.result = { status: 400, body: '{"error":{"code":"validation_error","message":"Bad file"}}' };
    await expect(uploadFileAsync('a.jpg', 'file:///a.jpg', identity)).rejects.toThrow(/^Bad file$/);
  });

  it('rejects with the status when the body is not the error envelope', async () => {
    upload.result = { status: 502, body: '<html>Bad Gateway</html>' };
    await expect(uploadFileAsync('a.jpg', 'file:///a.jpg', identity)).rejects.toThrow(
      /^Upload failed with status 502$/,
    );
  });

  it('rejects with an UpdateRequiredError when the server refuses this build as too old, and a later upload clears it', async () => {
    upload.result = { status: 426, body: '{"error":{"code":"update_required","message":"version 1; needs 2"}}' };
    await expect(uploadFileAsync('a.jpg', 'file:///a.jpg', identity)).rejects.toBeInstanceOf(UpdateRequiredError);
    expect(updateRequiredStore.get()).toBe(true);
    upload.result = { status: 200, body: '' };
    await uploadFileAsync('a.jpg', 'file:///a.jpg', identity);
    expect(updateRequiredStore.get()).toBe(false);
  });

  it('reports the byte counts as numbers when the native task sends BigInts', async () => {
    upload.result = { status: 200, body: '' };
    upload.progress = [{ bytesSent: BigInt(512), totalBytes: BigInt(2048) }];
    const onProgress = vi.fn();
    await uploadFileAsync('a.jpg', 'file:///a.jpg', identity, { onProgress });
    expect(onProgress).toHaveBeenCalledWith({ bytesSent: 512, totalBytes: 2048 });
    upload.progress = [];
  });
});
