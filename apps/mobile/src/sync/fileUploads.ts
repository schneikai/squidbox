import { FileUploadRefusedError } from './fileUploadErrors';
import type { UploadFile } from './worker';

import UploadFailedError from '@/features/cloud/assets/UploadFailedError';
import uploadFileAsync from '@/features/cloud/assets/uploadFileAsync';
import { fileExists } from '@/library/fs';
import type { LibraryPaths } from '@/library/libraryPaths';
import type { SyncIdentity } from '@/library/sessionMatches';
import { getAvatarUri } from '@/utils/assets/assetStorage';

// Where each file field's files live on this device, and what to call them in an error.
const FILE_FIELDS: Record<string, { label: string; uriOf: (filename: string, library: LibraryPaths) => string }> = {
  'contacts.avatarFilename': { label: 'Contact photo', uriOf: getAvatarUri },
};

// What the upload route answers the same way on every try: a bad request, a refused library (the dev
// copy's read_only_library), a missing route, a purged key, a file over the limit. Anything else (a
// 401 after the refresh, a 429, a 5xx, the network) fails the run and is tried by the next sync.
const REFUSED_STATUSES = new Set([400, 403, 404, 410, 413]);

/**
 * The sync's file uploads for `identity`'s session and `library`'s folders (sync-design §6): uploads
 * a file field's file under its name, and throws a FileUploadRefusedError for what fails the same way
 * next time (a refusal by its status, or a file missing from the device).
 */
export function fileUploader(identity: SyncIdentity, library: LibraryPaths): UploadFile {
  return async (collection, field, filename, signal) => {
    const location = FILE_FIELDS[`${collection}.${field}`];
    if (!location) throw new Error(`No folder on this device for the files of ${collection}.${field}`);
    const uri = location.uriOf(filename, library);
    if (!(await fileExists(uri)))
      throw new FileUploadRefusedError(
        `${location.label} is missing on this device: choose it again or remove it`,
        'missing on this device',
      );
    try {
      await uploadFileAsync(filename, uri, identity, { signal });
    } catch (error) {
      if (error instanceof UploadFailedError && REFUSED_STATUSES.has(error.status))
        throw new FileUploadRefusedError(
          `${location.label} upload refused (${error.message})`,
          error.code ?? `status ${error.status}`,
        );
      throw error;
    }
  };
}
