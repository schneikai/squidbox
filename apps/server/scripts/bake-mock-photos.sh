#!/usr/bin/env bash
# Bakes the mock photos that `npm run seed:mock` uploads: Unsplash stock photos (free to use under
# the Unsplash License) fitted within 2048 px, each with a thumbnail at the app's size, and the
# contacts' portraits cropped square. Writes scripts/mock-photos/ with <id>.jpg, <id>-thumb.jpg,
# <id>-avatar.jpg and photos.json (size per photo), all committed, so seeding (and CI) needs no
# network. Run it only to change the set: ./scripts/bake-mock-photos.sh
set -euo pipefail

# Unsplash photo ids (images.unsplash.com/photo-<id>) of the MEDIA photos in seed-mock.ts.
PHOTOS=(
  1445363692815-ebcd599f7621 1472214103451-9374bd1c798e 1500964757637-c85e8a162699
  1433086966358-54859d0ed716 1507525428034-b723cf961d3e 1499678329028-101435549a4e
  1414609245224-afa02bfb3fda 1501785888041-af3ef285b470 1464822759023-fed622ff2c3b
  1504280390367-361c6d9f38f4 1478131143081-80f7f84ca84d 1454496522488-7a8e488e8606
  1551632811-561732d1e306 1441974231531-c6227db76b6e 1447752875215-b2761acb3c5d
  1418065460487-3e41a6c84dc5 1520962922320-2038eebab146 1446329813274-7c9036bd9a1f
  1519904981063-b0cf448d479e 1493246507139-91e8fad9978e 1468276311594-df7cb65d8df6
  1426604966848-d7adac402bff 1476514525535-07fb3b4ae5f1 1519681393784-d120267933ba
  1500530855697-b586d89ba3ee 1508193638397-1c4234db14d8 1470071459604-3b5ec3a7fe05
  1501555088652-021faa106b9b 1506905925346-21bda4d32df4 1510414842594-a61c69b5ae57
  1500534314209-a25ddb2bd429 1513836279014-a89f7a76ae86 1518173946687-a4c8892bbd9f
  1503614472-8c93d56e92ce 1522163182402-834f871fd851 1487730116645-74489c95b41b
  1523712999610-f77fbcfc3843 1470770841072-f978cf4d019e 1511497584788-876760111969
  1543039625-14cbd3802e7d 1527489377706-5bf97e608852 1482192596544-9eb780fc7f66
  1494500764479-0c8f2919a3d8
)
# Unsplash photo ids of the CONTACTS avatars in seed-mock.ts.
AVATARS=(
  1506794778202-cad84cf45f1d 1438761681033-6461ffad8d80 1527980965255-d3b416303d12
  1494790108377-be9c29b29330 1560250097-0b93528c311a
)
FULL_SIZE=2048
THUMBNAIL_SIZE=1000 # matches the app's createImageThumbnail
AVATAR_SIZE=512

dest="$(cd "$(dirname "$0")" && pwd)/mock-photos"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
# Bakes into a fresh folder and swaps it in only once every photo succeeded.
out="$work/mock-photos"
mkdir -p "$out"

fetch() { curl -fsSL --retry 5 --retry-all-errors "$@"; }

manifest="{"
for id in "${PHOTOS[@]}"; do
  # Unsplash's image CDN resizes: within FULL_SIZE on the longer side, never scaled up.
  fetch -o "$out/$id.jpg" "https://images.unsplash.com/photo-$id?w=$FULL_SIZE&h=$FULL_SIZE&fit=max&q=72&fm=jpg"
  IFS=x read -r width height < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height \
    -of csv=p=0:s=x "$out/$id.jpg")
  # The thumbnail, as the app's createImageThumbnail makes it.
  ffmpeg -v error -y -i "$out/$id.jpg" -q:v 3 \
    -vf "scale=w=$THUMBNAIL_SIZE:h=$THUMBNAIL_SIZE:force_original_aspect_ratio=decrease" "$out/$id-thumb.jpg"
  manifest+="\"$id\":{\"width\":$width,\"height\":$height},"
  echo "Baked photo $id (${width}x$height)"
done
for id in "${AVATARS[@]}"; do
  fetch -o "$out/$id-avatar.jpg" \
    "https://images.unsplash.com/photo-$id?w=$AVATAR_SIZE&h=$AVATAR_SIZE&fit=crop&crop=faces&q=80&fm=jpg"
  echo "Baked avatar $id"
done
echo "${manifest%,}}" | python3 -m json.tool --indent 2 >"$out/photos.json"
rm -rf "$dest"
mv "$out" "$dest"
