// assets must be an array of objects!
export default function prepareAssets({ assets, sortFn, filterFn, filterDeleted = true, searchText = '' }) {
  const query = searchText.trim().toLowerCase();

  let matchedAssets = assets.filter((asset) => {
    if (filterDeleted && asset.isDeleted) return false;
    if (filterFn && !filterFn(asset)) return false;
    if (query && !asset.notes?.toLowerCase().includes(query)) return false;
    return true;
  });

  if (sortFn) matchedAssets = matchedAssets.sort(sortFn);

  return matchedAssets;
}
