/** The name of the album holding every one of `assetIds` (useAssetAlbums' `albums`), if one does. */
export default function fullAlbumName(
  albums: readonly { name: string; heldCount: number | null }[] | undefined,
  assetIds: readonly string[],
): string | undefined {
  const count = new Set(assetIds).size;
  return albums?.find((album) => album.heldCount === count)?.name;
}
