export default function formatVideoDuration(duration) {
  if (!duration) return;

  // convert milliseconds duration to minutes:seconds
  const minutes = Math.floor(duration / 60000);
  const seconds = ((duration % 60000) / 1000).toFixed(0).padStart(2, '0');

  return `${minutes}:${seconds}`;
}
