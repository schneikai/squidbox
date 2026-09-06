export default function getFileExtensionFromUrl(url) {
  return url.split(/[#?]/)[0].split('.').pop().trim();
}
