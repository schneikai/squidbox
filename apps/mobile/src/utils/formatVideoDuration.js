// Milliseconds as m:ss, rounded to the second as a whole, so 59.6 s reads 1:00, never 0:60.
export default function formatVideoDuration(duration) {
  if (!Number.isFinite(duration)) return;

  const totalSeconds = Math.round(duration / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return `${minutes}:${seconds}`;
}
