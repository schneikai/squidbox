import { File } from 'expo-file-system';

import { getAvatarUri, hasAvatarAsync } from '@/utils/assets/assetStorage';
import getAssetFileDownloadUrlsAsync from '@/utils/cloud-api/assets/getAssetFileDownloadUrlsAsync';

const DOWNLOADS_AT_ONCE = 3; // per batch; the loader runs two

// Downloads the avatars of `contacts` not in `library` yet and resolves the names of those it has
// afterwards, as preloadAssetThumbnailsAsync does thumbnails. Throws when it can't ask for any (the
// presign request failed). Once `signal` aborts, no new download starts.
export default async function preloadAvatarsAsync(contacts, library, signal) {
  const names = contacts.map((contact) => contact.avatarFilename);
  const isOnDevice = await Promise.all(names.map((name) => hasAvatarAsync(name, library)));
  const available = new Set(names.filter((_, index) => isOnDevice[index]));
  const missing = names.filter((_, index) => !isOnDevice[index]);
  if (missing.length === 0 || signal?.aborted) return available;

  const pending = await getAssetFileDownloadUrlsAsync(missing);
  async function downloadNext() {
    while (pending.length > 0 && !signal?.aborted) {
      const [avatarFilename, presignedUrl] = pending.shift();
      try {
        await File.downloadFileAsync(presignedUrl, new File(getAvatarUri(avatarFilename, library)), {
          idempotent: true,
        });
        available.add(avatarFilename);
      } catch {
        // A network error or a failed response writes no file: the loader tries it again.
      }
    }
  }
  await Promise.all(Array.from({ length: DOWNLOADS_AT_ONCE }, downloadNext));
  return available;
}
