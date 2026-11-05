import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { getAvatarUri } from '@/utils/assets/assetStorage';
import getImageDimensionsAsync from '@/utils/getImageDimensionsAsync';

const SIZE = 512;
const QUALITY = 0.8;

/**
 * Makes a contact's photo from the picture at `sourceUri`: its centre square as a 512 px JPEG,
 * written into the library's avatars folder as `avatarFilename`.
 */
export default async function makeAvatarAsync(sourceUri, avatarFilename, library) {
  const { width, height } = await getImageDimensionsAsync(sourceUri);
  const side = Math.min(width, height);
  const context = ImageManipulator.manipulate(sourceUri)
    .crop({
      originX: Math.floor((width - side) / 2),
      originY: Math.floor((height - side) / 2),
      width: side,
      height: side,
    })
    .resize({ width: Math.min(SIZE, side) });
  try {
    const image = await context.renderAsync();
    try {
      const { uri } = await image.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
      const target = new File(getAvatarUri(avatarFilename, library));
      if (target.exists) target.delete();
      new File(uri).move(target);
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}
