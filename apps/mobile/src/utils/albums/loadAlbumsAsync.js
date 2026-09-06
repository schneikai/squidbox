import addSmartAlbumsAsync from '@/utils/albums/addSmartAlbumsAsync';
import readLocalDataAsync from '@/utils/local-data/readLocalDataAsync';
import writeLocalDataAsync from '@/utils/local-data/writeLocalDataAsync';

export default async function loadAlbumsAsync() {
  const filename = 'albums.json';
  const data = await readLocalDataAsync(filename);

  await addSmartAlbumsAsync(data);

  // // delete old system albums (we now use smart albums)
  // for (const albumId of Object.keys(data)) {
  //   const album = data[albumId];
  //   if (!album.isSystemAlbum) continue;
  //   delete data[albumId];
  // }

  // // add smartAlbumType default
  // for (const albumId of Object.keys(data)) {
  //   const album = data[albumId];
  //   if (album.hasOwnProperty('smartAlbumType')) continue;
  //   album.smartAlbumType = null;
  // }

  // // add updatedAt
  // for (const albumId of Object.keys(data)) {
  //   const album = data[albumId];
  //   if (album.hasOwnProperty('updatedAt')) continue;
  //   album.updatedAt = album.createdAt;
  // }

  // // delete old isSystemAlbum key
  // for (const albumId of Object.keys(data)) {
  //   const album = data[albumId];
  //   delete album.isSystemAlbum;
  // }

  // // add archivedAt
  // for (const albumId of Object.keys(data)) {
  //   const album = data[albumId];
  //   album.archivedAt = null;
  //   delete album.isArchived;
  // }

  // // add showInPostSuggestionsAfter
  // for (const albumId of Object.keys(data)) {
  //   const album = data[albumId];
  //   album.showInPostSuggestionsAfter = null;
  // }

  // console.log('Writing albums.json...');

  await writeLocalDataAsync(filename, data);

  return data;
}
