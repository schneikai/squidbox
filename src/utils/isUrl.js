export default function isUrl(url) {
  return url.startsWith('http://') || url.startsWith('https://');
}
