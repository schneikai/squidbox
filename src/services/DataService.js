export function querySnapshotToData(querySnapshot) {
  const assets = [];
  querySnapshot.forEach((docSnapshot) => {
    assets.push(docSnapshotToData(docSnapshot));
  });
  return assets;
}

export function docSnapshotToData(docSnapshot) {
  return { ...docSnapshot.data(), id: docSnapshot.id };
}
