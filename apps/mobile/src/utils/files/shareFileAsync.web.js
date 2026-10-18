import getFileExtension from './getFileExtension';

const MIME_TYPES = {
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

// Fetches the file and resolves once its share (Web Share API) or download has started; a later
// failure goes to `onError`. When the fetch gets no response (the bucket allows no CORS), the
// browser opens the URL itself.
export default async function shareFileAsync(uri, filename, onError) {
  let response;
  try {
    response = await fetch(uri);
  } catch {
    clickLink(uri, filename);
    return;
  }
  if (!response.ok) throw new Error(`Fetching ${filename} failed (HTTP ${response.status})`);
  const type = MIME_TYPES[getFileExtension(filename)?.toLowerCase()] ?? '';
  const file = new File([await response.blob()], filename, { type });

  if (!navigator.canShare?.({ files: [file] })) {
    download(file);
    return;
  }
  navigator.share({ files: [file] }).catch((error) => {
    // NotAllowedError: the tap's activation ran out during the fetch.
    if (error.name === 'NotAllowedError') download(file);
    else if (error.name !== 'AbortError') onError(error);
  });
}

function download(file) {
  const url = URL.createObjectURL(file);
  clickLink(url, file.name);
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY);
}

function clickLink(href, filename) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.target = '_blank';
  link.click();
}
