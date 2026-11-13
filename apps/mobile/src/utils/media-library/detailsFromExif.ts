// The date taken and place of a photo, from the EXIF the image picker read off its file (`exif: true`).
// iOS gives GPS as positive degrees with an N/S and E/W ref; Android gives them signed. A date
// without its offset is in the phone's time zone, as the camera wrote it. Null for what the file
// doesn't have (a video, a screenshot without GPS) or can't be read.
export default function detailsFromExif(exif: Record<string, unknown> | null | undefined) {
  if (!exif) return { creationTime: null, location: null };
  const latitude = coordinate(exif.GPSLatitude, exif.GPSLatitudeRef, 'S');
  const longitude = coordinate(exif.GPSLongitude, exif.GPSLongitudeRef, 'W');
  return {
    creationTime: exifTime(exif.DateTimeOriginal ?? exif.DateTimeDigitized, exif.OffsetTimeOriginal),
    location: latitude === null || longitude === null ? null : { latitude, longitude },
  };
}

function coordinate(value: unknown, ref: unknown, negativeRef: 'S' | 'W'): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value > 0 && ref === negativeRef ? -value : value;
}

// "2024:06:01 14:03:22" and an optional "+02:00".
function exifTime(value: unknown, offset: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const zone = typeof offset === 'string' && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : '';
  const time = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${zone}`).getTime();
  return Number.isNaN(time) ? null : time;
}
