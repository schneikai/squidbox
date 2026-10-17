// A player that has reached the end stops there: playing it again starts it over.
const END_TOLERANCE_SECONDS = 0.1;

export default function playVideo(player) {
  const hasEnded = player.duration > 0 && player.currentTime >= player.duration - END_TOLERANCE_SECONDS;
  if (hasEnded) player.replay();
  else player.play();
}
