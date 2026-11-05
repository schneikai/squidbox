import readContactScreenshotAsync from '@/utils/cloud-api/ai/readContactScreenshotAsync';
import pickImageFromMediaLibrary from '@/utils/media-library/pickImageFromMediaLibrary';
import resizeToJpegAsync from '@/utils/thumbnails/resizeToJpegAsync';

// Big enough that a profile's small text stays readable (a 512 px photo for tags would lose it),
// small enough for the request's limit.
const SCREENSHOT = { longSide: 1536, quality: 0.8 };

/**
 * Picks a profile screenshot and has the assistant read it: resolves to the fields it read
 * (readContactScreenshotAsync), or null when nothing was picked. Throws what the server said.
 */
export default async function contactFromScreenshotAsync() {
  const [picked] = (await pickImageFromMediaLibrary({ mediaTypes: ['images'], allowsMultipleSelection: false })) ?? [];
  if (!picked) return null;
  const { base64 } = await resizeToJpegAsync(picked.uri, {
    width: picked.width,
    height: picked.height,
    longSide: Math.min(SCREENSHOT.longSide, Math.max(picked.width, picked.height)),
    quality: SCREENSHOT.quality,
    base64: true,
  });
  return readContactScreenshotAsync({ base64, mimeType: 'image/jpeg' });
}
