import squareCrop from './squareCrop';

import type { CropPhoto } from '@/providers/photo-crop/PhotoCropContext';
import resizeToJpegAsync from '@/utils/thumbnails/resizeToJpegAsync';

// Larger than a contact's photo (makeAvatarAsync makes it 512 px from this), so that one is made
// from a sharp picture and not from a JPEG of its own size.
const LONG_SIDE = 1024;
const QUALITY = 0.95;

// The square of `photo` at `position` (squareCrop) as a JPEG file: resolves to its uri.
export default async function cropPhotoAsync(photo: CropPhoto, position: number): Promise<string> {
  const crop = squareCrop(photo, position);
  const { uri } = await resizeToJpegAsync(photo.uri, {
    crop,
    width: crop.width,
    height: crop.height,
    longSide: Math.min(LONG_SIDE, crop.width),
    quality: QUALITY,
  });
  return uri;
}
