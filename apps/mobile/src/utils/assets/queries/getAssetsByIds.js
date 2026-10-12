// The assets for `ids`, in that order, skipping ids that aren't in the map. A lookup per id, so
// it stays cheap with a large library and many selected assets.
export default function getAssetsByIds(assets, ids) {
  return ids.map((id) => assets[id]).filter(Boolean);
}
