import { describe, expect, it, vi } from 'vitest';

import uploadFileAsync from '../src/features/cloud/assets/uploadFileAsync';

// The upload task is expo-file-system's native one: it resolves the response it is given here.
const upload = vi.hoisted(() => ({ result: undefined as { status: number; body: string } | undefined }));
vi.mock('expo-file-system', () => ({
  UploadType: { BINARY_CONTENT: 0 },
  File: class {
    createUploadTask() {
      return { uploadAsync: async () => upload.result };
    }
  },
}));
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
});
