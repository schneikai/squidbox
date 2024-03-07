import oldestFiles from '../../../assets/oldest_files';

import useAlbums from '@/features/albums-context/useAlbums';
import useAssets from '@/features/assets-context/useAssets';
import writeLocalDataAsync from '@/utils/local-data/writeLocalDataAsync';

export default function useFixAlbumsCreatedAt() {
  const { assets } = useAssets();
  const { albums } = useAlbums();

  async function fixAlbumsCreatedAtAsync() {
    const allAlbums = { ...albums };
    const allAssets = { ...assets };

    for (const albumInfo of oldestFiles) {
      const albums = Object.values(allAlbums).filter((album) => album.name === albumInfo.folder);
      if (albums.length > 1) {
        throw new Error(`Multiple albums with name ${albumInfo.folder} found.`);
      }

      const album = albums[0];
      if (!album) {
        console.log(`Album ${albumInfo.folder} not found.`);
        continue;
      }
      const createdAt = new Date(albumInfo.createdAt).getTime();
      console.log(`Updating ${album.name}: ${createdAt}...`);

      allAlbums[album.id] = {
        ...album,
        createdAt,
      };

      for (const assetId of album.assets) {
        const asset = allAssets[assetId];
        if (!asset) {
          console.log(`Asset ${assetId} not found.`);
          continue;
        }
        allAssets[assetId] = {
          ...asset,
          createdAt,
        };
      }
    }

    await writeLocalDataAsync('albums.json', allAlbums);
    await writeLocalDataAsync('assets.json', allAssets);

    console.log('Done!');
  }

  return fixAlbumsCreatedAtAsync;
}
