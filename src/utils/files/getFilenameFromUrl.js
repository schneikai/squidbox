export default function getFilenameFromUrl(url) {
  // Split the URL by '/'
  const parts = url.split('/');

  // Get the last part of the array
  const lastPart = parts.pop() || '';

  // If there's a query string or hash, remove it
  return lastPart.split(/[?#]/)[0];
}
