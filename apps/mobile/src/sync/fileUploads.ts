import { FileUploadRefusedError, MISSING_ON_DEVICE } from './fileUploadErrors';
import type { UploadFile } from './worker';

import UploadFailedError from '@/features/cloud/assets/UploadFailedError';
import uploadFileAsync from '@/features/cloud/assets/uploadFileAsync';
import { fileFieldLocation } from '@/library/fileFields';
import { fileExists } from '@/library/fs';
import type { LibraryPaths } from '@/library/libraryPaths';
import type { SyncIdentity } from '@/library/sessionMatches';
import { getFieldFileUri } from '@/utils/assets/assetStorage';

/**
 * The sync's file uploads for `identity`'s session and `library`'s folders (sync-design §6): uploads
 * a file field's file under its name, and throws a FileUploadRefusedError for what fails the same way
 * next time (a refusal by its status, or a file missing from the device).
 */
export function fileUploader(identity: SyncIdentity, library: LibraryPaths): UploadFile {
  return async (collection, field, filename, signal) => {
    const location = fileFieldLocation(collection, field);
    const uri = getFieldFileUri(location.folder, filename, library);
    if (!(await fileExists(uri)))
      throw new FileUploadRefusedError(
        `${location.label} ${MISSING_ON_DEVICE}: choose it again or remove it`,
        MISSING_ON_DEVICE,
      );
    try {
      await uploadFileAsync(filename, uri, identity, { signal });
    } catch (error) {
      if (error instanceof UploadFailedError && error.isRefusal)
        throw new FileUploadRefusedError(
          `${location.label} upload refused (${error.message})`,
          error.code ?? `status ${error.status}`,
        );
      throw error;
    }
  };
}
