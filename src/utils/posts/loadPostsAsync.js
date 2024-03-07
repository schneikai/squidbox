import readLocalDataAsync from '@/utils/local-data/readLocalDataAsync';
// import writeLocalDataAsync from '@/utils/local-data/writeLocalDataAsync';

export default async function loadPostsAsync() {
  const filename = 'posts.json';
  const data = await readLocalDataAsync(filename);

  // // Rename postAssets to assetRefs
  // for (const postId of Object.keys(data)) {
  //   const post = data[postId];
  //   if (post.hasOwnProperty('assetRefs')) continue;
  //   post.assetRefs = post.postAssets;
  //   delete post.postAssets;
  // }

  // // Add updatedAt
  // for (const postId of Object.keys(data)) {
  //   const post = data[postId];
  //   if (post.hasOwnProperty('updatedAt')) continue;
  //   post.updatedAt = post.createdAt;
  // }

  // // Add rePostId
  // for (const postId of Object.keys(data)) {
  //   const post = data[postId];
  //   post.rePostId = null;
  // }

  // await writeLocalDataAsync(filename, data);

  return data;
}
