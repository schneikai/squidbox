import { isFileName } from '@/library/fileFields';
import type { LibraryPaths } from '@/library/libraryPaths';
import { getAvatarUri, hasAvatar } from '@/utils/assets/assetStorage';

// The photos found on this device since launch, by uri: an avatar shown again (a row scrolled back,
// the same contact in a row and a stack) skips the file check.
const foundUris = new Set<string>();
const MAX_FOUND_URIS = 2000;

/** Remembers that the photo named `filename` is on the device now (fetched by the loader). */
export function rememberAvatarOnDevice(filename: string, library: Pick<LibraryPaths, 'avatarsDir'>) {
  const uri = getAvatarUri(filename, library);
  const oldest = foundUris.values().next();
  if (foundUris.size >= MAX_FOUND_URIS && !oldest.done) foundUris.delete(oldest.value);
  foundUris.add(uri);
}

/**
 * The uri of the contact photo named `filename` when the file is on this device, remembered once it
 * is (a synchronous check, so a photo on the device shows in the first frame); null when it isn't,
 * and for no name or a name that isn't a file name (isFileName).
 */
export default function avatarOnDevice(
  filename: string | null | undefined,
  library: Pick<LibraryPaths, 'avatarsDir'>,
): string | null {
  if (!filename || !isFileName(filename)) return null;
  const uri = getAvatarUri(filename, library);
  if (foundUris.has(uri)) return uri;
  if (!hasAvatar(filename, library)) return null;
  rememberAvatarOnDevice(filename, library);
  return uri;
}
