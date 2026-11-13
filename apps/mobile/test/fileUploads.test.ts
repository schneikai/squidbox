import { collections, contactCollection } from '@squidbox/shared';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { FILE_FIELDS, isFileName } from '../src/library/fileFields';
import { libraryPaths } from '../src/library/libraryPaths';
import { FileUploadRefusedError } from '../src/sync/fileUploadErrors';
import UploadFailedError from '../src/utils/cloud-api/assets/UploadFailedError';

const onDevice = new Set<string>();
const upload = vi.fn();
vi.mock('../src/library/fs', () => ({ fileExists: async (uri: string) => onDevice.has(uri) }));
vi.mock('../src/utils/assets/assetStorage', () => ({
  getFieldFileUri: (folder: string, filename: string, library: Record<string, string>) =>
    `file:///docs/${library[folder]}${filename}`,
}));
vi.mock('../src/utils/cloud-api/assets/uploadFileAsync', () => ({
  default: (...args: unknown[]) => upload(...args),
}));

const { fileUploader } = await import('../src/sync/fileUploads');

const library = libraryPaths('abc');
const identity = { serverId: 's', userId: 'u' } as never;
const uri = 'file:///docs/libraries/abc/avatars/avatar-x-1.jpg';
const uploadFile = fileUploader(identity, library);
const run = () => uploadFile('contacts', 'avatarFilename', 'avatar-x-1.jpg', new AbortController().signal);

beforeEach(() => {
  onDevice.clear();
  onDevice.add(uri);
  upload.mockReset();
});

describe('fileUploader', () => {
  it('uploads a contact photo from the library’s avatars folder under its name', async () => {
    await run();
    expect(upload).toHaveBeenCalledWith('avatar-x-1.jpg', uri, identity, { signal: expect.any(AbortSignal) });
  });

  it('refuses a photo missing from the device without trying the upload', async () => {
    onDevice.clear();
    await expect(run()).rejects.toThrow(
      new FileUploadRefusedError(
        'Contact photo is missing on this device: choose it again or remove it',
        'is missing on this device',
      ),
    );
    expect(upload).not.toHaveBeenCalled();
  });

  for (const status of [400, 403, 404, 410, 413]) {
    it(`refuses on a ${status}, with the server's message`, async () => {
      upload.mockRejectedValue(new UploadFailedError('No uploads here', { status, code: 'read_only_library' }));
      const error = await run().catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(FileUploadRefusedError);
      expect(error).toMatchObject({
        message: 'Contact photo upload refused (No uploads here)',
        reason: 'read_only_library',
      });
    });
  }

  for (const [name, failure] of [
    ['a 401 after the refresh', new UploadFailedError('Unauthorized', { status: 401 })],
    ['a 429', new UploadFailedError('Too many concurrent uploads', { status: 429, code: 'rate_limited' })],
    ['a 500', new UploadFailedError('Upload failed with status 500', { status: 500 })],
    ['a network error', new Error('Network request failed')],
  ] as const) {
    it(`passes ${name} on as it is, not as a refusal`, async () => {
      upload.mockRejectedValue(failure);
      const error = await run().catch((caught: unknown) => caught);
      expect(error).toBe(failure);
    });
  }

  it('throws for a file field it has no folder for', async () => {
    await expect(uploadFile('assets', 'filename', 'a.jpg', new AbortController().signal)).rejects.toThrow(
      'No folder on this device for the files of assets.filename',
    );
  });
});

describe('FILE_FIELDS', () => {
  it('has a folder on this device for every file field of a collection, and for nothing else', () => {
    const fileFields = collections.flatMap(({ name, fileFields }) => fileFields.map((field) => `${name}.${field}`));
    expect(Object.keys(FILE_FIELDS).sort()).toEqual(fileFields.sort());
  });
});

describe('a file field’s name', () => {
  it('is a flat file name on the device and in the synced contact, never a path', () => {
    const valid = (avatarFilename: string) =>
      contactCollection.schema.shape.avatarFilename.safeParse(avatarFilename).success;
    expect(isFileName('avatar-x-1.jpg')).toBe(true);
    expect(valid('avatar-x-1.jpg')).toBe(true);
    for (const name of ['../library-x.db', 'avatar-x/../../a.jpg', '.hidden', '/etc/passwd', '']) {
      expect(isFileName(name), name).toBe(false);
      expect(valid(name), name).toBe(false);
    }
  });
});
