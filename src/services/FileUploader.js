import * as FileSystem from "expo-file-system";
import * as HttpService from "services/HttpService";
import config from "constants/config";

const API_BASE_URL = config.uploaderUrl;
const INIT_UPLOAD_API_URL = `${API_BASE_URL}upload/init`;

export async function uploadFile(filename, localUri) {
  const {
    data: { presignedUrl, publicUrl },
  } = await HttpService.post(INIT_UPLOAD_API_URL, {
    filename: filename,
  });

  await FileSystem.uploadAsync(presignedUrl, localUri, {
    httpMethod: "PUT",
    sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
  });

  return publicUrl;
}
