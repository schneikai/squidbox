import getFileExtension from './getFileExtension';
import type { ShareFile } from './shareFilesAsync';

const MIME_TYPES: Partial<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  heic: 'image/heic',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

const REVOKE_DELAY = 60_000; // ms, so the browser has started the download

// Fetches every file, all at once (the tap's activation, which sharing needs, lasts only seconds),
// and shares them in one go (Web Share API), or downloads each where the browser can't share them.
// Resolves once that has started; a file that can't be fetched rejects. When a fetch gets no
// response (the bucket allows no CORS), the browser opens that URL itself.
export default async function shareFilesAsync(files: readonly ShareFile[]): Promise<void> {
  const fetched = (await Promise.all(files.map(fetchFileAsync))).filter((file) => file !== null);
  if (fetched.length === 0) return;

  if (!navigator.canShare?.({ files: fetched })) {
    fetched.forEach(download);
    return;
  }
  try {
    await navigator.share({ files: fetched });
  } catch (error) {
    // AbortError: the sheet was closed. NotAllowedError: the tap's activation ran out during the fetch.
    if (!(error instanceof Error)) throw error;
    if (error.name === 'NotAllowedError') fetched.forEach(download);
    else if (error.name !== 'AbortError') throw error;
  }
}

// The file, or null when the browser opened its URL itself.
async function fetchFileAsync({ uri, filename }: ShareFile): Promise<File | null> {
  let response;
  try {
    response = await fetch(uri);
  } catch {
    clickLink(uri, filename);
    return null;
  }
  if (!response.ok) throw new Error(`Fetching ${filename} failed (HTTP ${response.status})`);
  const type = MIME_TYPES[getFileExtension(filename)?.toLowerCase() ?? ''] ?? '';
  return new File([await response.blob()], filename, { type });
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  clickLink(url, file.name);
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY);
}

function clickLink(href: string, filename: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.target = '_blank';
  link.click();
}
