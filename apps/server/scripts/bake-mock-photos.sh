#!/usr/bin/env bash
# Bakes the mock photos that `npm run seed:mock` uploads: each picsum.photos stock photo (free to
# use) at the seed's full size with a thumbnail at the app's size, and the contact photos. Writes
# scripts/mock-photos/ with <id>.jpg, <id>-thumb.jpg, <id>-avatar.jpg and photos.json (full size
# per photo), all committed, so seeding (and CI) needs no network. Run it only to change the set:
# ./scripts/bake-mock-photos.sh
set -euo pipefail

# Picsum ids of the MEDIA photos in seed-mock.ts.
PHOTOS=(10 11 195 13 14 260 15 16 520 17 18 613 19 20 638 22 24 722 25 27 735 28 29 776 36 37 842
  39 42 870 43 49 873 50 53 1003 54 57 1065 58 63 64 65)
# Picsum ids of the CONTACTS avatars in seed-mock.ts.
AVATARS=(1005)
FULL_SIZE=2048
THUMBNAIL_SIZE=1000 # matches the app's createImageThumbnail
AVATAR_SIZE=512

dest="$(cd "$(dirname "$0")" && pwd)/mock-photos"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
# Bakes into a fresh folder and swaps it in only once every photo succeeded.
out="$work/mock-photos"
mkdir -p "$out"

# picsum.photos fails now and then (a 522), so each request retries.
fetch() { curl -fsSL --retry 5 --retry-all-errors "$@"; }

manifest="{"
for id in "${PHOTOS[@]}"; do
  # The original's size, fitted within FULL_SIZE (never scaled up).
  read -r full_w full_h < <(fetch "https://picsum.photos/id/$id/info" | jq -r --argjson max "$FULL_SIZE" '
    ([1, $max / ([.width, .height] | max)] | min) as $s
    | "\((.width * $s) | round) \((.height * $s) | round)"')
  fetch -o "$out/$id.jpg" "https://picsum.photos/id/$id/$full_w/$full_h.jpg"
  # The thumbnail, as the app's createImageThumbnail makes it.
  ffmpeg -v error -y -i "$out/$id.jpg" -q:v 3 \
    -vf "scale=w=$THUMBNAIL_SIZE:h=$THUMBNAIL_SIZE:force_original_aspect_ratio=decrease" "$out/$id-thumb.jpg"
  manifest+="\"$id\":{\"width\":$full_w,\"height\":$full_h},"
  echo "Baked photo $id (${full_w}x$full_h)"
done
for id in "${AVATARS[@]}"; do
  fetch -o "$out/$id-avatar.jpg" "https://picsum.photos/id/$id/$AVATAR_SIZE/$AVATAR_SIZE.jpg"
  echo "Baked avatar $id"
done
echo "${manifest%,}}" | python3 -m json.tool --indent 2 >"$out/photos.json"
rm -rf "$dest"
mv "$out" "$dest"
