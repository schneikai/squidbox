// import assetSchema from './assetSchema';

// import getAssetFileExistsAsync from '@/utils/cloud-api/assets/getAssetFileExistsAsync';
// import getAssetFileSizeAsync from '@/utils/cloud-api/assets/getAssetFileSizeAsync';
// import getFilenameFromUrl from '@/utils/files/getFilenameFromUrl';
import readLocalDataAsync from '@/utils/local-data/readLocalDataAsync';
// import writeLocalDataAsync from '@/utils/local-data/writeLocalDataAsync';

export default async function loadAssetsAsync() {
  const filename = 'assets.json';
  const data = await readLocalDataAsync(filename);

  // TODO: We limit data for debugging
  // data = Object.fromEntries(Object.entries(data).slice(0, 10));

  // TODO: We need a migration system for data.
  // Maybe implement like Rails: Have a folder with migration files and a timestamp in the filename.
  // Keep track of migrations that have been applied and apply new migrations.

  // // Add updatedAt
  // for (const assetId of Object.keys(data)) {
  //   const asset = data[assetId];
  //   if (asset.hasOwnProperty('updatedAt')) continue;
  //   asset.updatedAt = asset.createdAt;
  // }

  // // Add filename
  // for (const assetId of Object.keys(data)) {
  //   const asset = data[assetId];
  //   if (asset.hasOwnProperty('filename')) continue;
  //   if (!asset.fileUrl) {
  //     delete data[assetId];
  //     continue;
  //   }
  //   asset.filename = getFilenameFromUrl(asset.fileUrl);
  //   delete asset.fileUrl;
  //   delete asset.fileUri;
  // }

  // // Add thumbnailFilename
  // for (const assetId of Object.keys(data)) {
  //   const asset = data[assetId];
  //   if (asset.hasOwnProperty('thumbnailFilename')) continue;
  //   if (!asset.thumbnailUrl) {
  //     delete data[assetId];
  //     continue;
  //   }
  //   asset.thumbnailFilename = getFilenameFromUrl(asset.thumbnailUrl);
  //   delete asset.thumbnailUrl;
  //   delete asset.thumbnailUri;
  // }

  // // Add isFileSynced, isThumbnailSynced and isSynced
  // // Remove isUploaded
  // for (const assetId of Object.keys(data)) {
  //   const asset = data[assetId];
  //   if (asset.hasOwnProperty('isFileSynced')) continue;
  //   asset.isFileSynced = !!asset.isUploaded;
  //   asset.isThumbnailSynced = !!asset.isUploaded;
  //   asset.isSynced = !!asset.isUploaded;
  //   delete asset.isUploaded;
  // }

  // // Add fileSize
  // for (const assetId of Object.keys(data)) {
  //   const asset = data[assetId];
  //   if (asset.hasOwnProperty('fileSize')) continue;
  //   asset.fileSize = await getAssetFileSizeAsync(asset.filename);
  // }

  // // Add mediaLibraryAssetId
  // for (const assetId of Object.keys(data)) {
  //   const asset = data[assetId];
  //   if (asset.mediaLibraryAssetId === -1) {
  //     asset.mediaLibraryAssetId = '__UNKNOWN__';
  //   }
  // }

  // // Validate the asset
  // for (const assetId of Object.keys(data)) {
  //   const asset = data[assetId];
  //   try {
  //     assetSchema.validateSync(asset);
  //   } catch (error) {
  //     console.log(`Invalid asset: ${assetId}`, error.message);
  //     const exists = await getAssetFileExistsAsync(asset.filename);
  //     console.log(`exists: ${exists}`, asset.filename);
  //     // delete data[assetId];
  //   }
  // }

  // await writeLocalDataAsync(filename, data);

  return data;
}
