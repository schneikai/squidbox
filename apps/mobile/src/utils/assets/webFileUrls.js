// Web has no file system to keep files in, so the web versions of the file helpers keep each
// thumbnail's and file field's file's presigned URL here, by its name, and let the browser cache it.
const webFileUrls = new Map();

export default webFileUrls;
