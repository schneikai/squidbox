import { File } from 'expo-file-system';

import type { LibraryPaths } from '@/library/libraryPaths';
import { getAvatarUri } from '@/utils/assets/assetStorage';
import getImageDimensionsAsync from '@/utils/getImageDimensionsAsync';
import resizeToJpegAsync from '@/utils/thumbnails/resizeToJpegAsync';

const SIZE = 512;
const QUALITY = 0.8;

/**
 * Makes a contact's photo from the picture at `sourceUri`: its centre square as a 512 px JPEG,
 * written into the library's avatars folder as `avatarFilename`. The picker crops to a square already;
 * the cut here keeps a picture from elsewhere square too.
 */
export default async function makeAvatarAsync(
  sourceUri: string,
  avatarFilename: string,
  library: Pick<LibraryPaths, 'avatarsDir'>,
): Promise<void> {
  const { width, height } = await getImageDimensionsAsync(sourceUri);
  const side = Math.min(width, height);
  const { uri } = await resizeToJpegAsync(sourceUri, {
    crop: {
      originX: Math.floor((width - side) / 2),
      originY: Math.floor((height - side) / 2),
      width: side,
      height: side,
    },
    width: side,
    height: side,
    longSide: Math.min(SIZE, side),
    quality: QUALITY,
  });
  const target = new File(getAvatarUri(avatarFilename, library));
  if (target.exists) target.delete();
  new File(uri).move(target);
}
