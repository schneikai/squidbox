// The web has no file system: `uri` is a URL (a thumbnail's is presigned), read through fetch.
export default async function readFileAsBase64Async(uri) {
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Couldn't read the file (${response.status})`);
  const blob = await response.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}
