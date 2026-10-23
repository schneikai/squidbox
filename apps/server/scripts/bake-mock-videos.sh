#!/usr/bin/env bash
# Bakes the mock videos that `npm run seed:mock` uploads: each silent Mixkit stock clip gets a
# Mixkit stock music track (both free to use) faded in and out under it, is cut to at most
# 12 seconds and compressed, and gets a thumbnail at the app's size. Writes scripts/mock-videos/
# with <clip>.mp4, <clip>.jpg and videos.json (size and duration in ms per clip), all committed,
# so seeding needs no ffmpeg. Run it only to change the set: ./scripts/bake-mock-videos.sh
set -euo pipefail

# "<Mixkit video id> <Mixkit music id>"
PAIRS=(
  "808 607"
  "1183 127"
  "4646 184"
  "1197 148"
  "529 148"
  "1214 127"
  "4132 184"
  "1164 607"
)
MAX_SECONDS=12
THUMBNAIL_SIZE=1000 # matches the app's createImageThumbnail

dest="$(cd "$(dirname "$0")" && pwd)/mock-videos"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
# Bakes into a fresh folder and swaps it in only once every clip succeeded.
out="$work/mock-videos"
mkdir -p "$out"

manifest="{"
for pair in "${PAIRS[@]}"; do
  read -r clip music <<<"$pair"
  curl -fsSL -o "$work/clip.mp4" "https://assets.mixkit.co/videos/$clip/$clip-720.mp4"
  curl -fsSL -o "$work/music.mp3" "https://assets.mixkit.co/music/$music/$music.mp3"

  clip_seconds=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$work/clip.mp4")
  seconds=$(awk -v d="$clip_seconds" -v m="$MAX_SECONDS" 'BEGIN { print (d < m ? d : m) }')
  fade_out=$(awk -v s="$seconds" 'BEGIN { print (s > 2 ? s - 2 : 0) }')
  ffmpeg -v error -y -i "$work/clip.mp4" -stream_loop -1 -i "$work/music.mp3" -t "$seconds" \
    -map 0:v -map 1:a -c:v libx264 -preset slow -crf 31 -pix_fmt yuv420p -c:a aac -b:a 96k \
    -af "afade=t=in:d=1,afade=t=out:st=$fade_out:d=2" -movflags +faststart "$out/$clip.mp4"

  IFS=x read -r width height < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height \
    -of csv=p=0:s=x "$out/$clip.mp4")
  duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out/$clip.mp4" |
    awk '{ printf "%d", $1 * 1000 + 0.5 }')
  # The first frame, as the app's createVideoThumbnail takes it.
  ffmpeg -v error -y -i "$out/$clip.mp4" -frames:v 1 -q:v 3 \
    -vf "scale=w=$THUMBNAIL_SIZE:h=$THUMBNAIL_SIZE:force_original_aspect_ratio=decrease" "$out/$clip.jpg"

  manifest+="\"$clip\":{\"width\":$width,\"height\":$height,\"duration\":$duration},"
  echo "Baked $clip (${width}x$height, ${duration}ms)"
done
echo "${manifest%,}}" | python3 -m json.tool --indent 2 >"$out/videos.json"
rm -rf "$dest"
mv "$out" "$dest"
