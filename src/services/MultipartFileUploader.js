import * as FileSystem from "expo-file-system";
import * as HttpService from "services/HttpService";
import { Buffer } from "buffer";
import { getFileSize } from "services/FileService";
import uuid from "react-native-uuid";
import config from "constants/config";

// If you want to change that we have to cancel all existing uploads!
// Have to think about how to handle this...
const PART_SIZE = 10 * 1024 * 1024; // 10 MB

// TODO: Maybe let the API controll part size
// just return parts from the api on initialize
// and split file based on the returned parts (startByte; endByte; ...)
// We could make the code here simpler

const API_BASE_URL = config.uploaderUrl;

const INIT_UPLOAD_API_URL = `${API_BASE_URL}multipart_upload/init`;
const PREPARE_UPLOAD_PART_API_URL = `${API_BASE_URL}multipart_upload/prepare_upload_part`;
const FINALIZE_UPLOAD_API_URL = `${API_BASE_URL}multipart_upload/finalize`;

const PART_FILE_TEMP_DIR = `${FileSystem.documentDirectory}multipartupload/`;

export async function isQualifiedForMultipartUpload(localUri) {
  const fileSize = await getFileSize(localUri);
  return fileSize > PART_SIZE;
}

export function uploadFile(identifier, filename, localUri, onProgress) {
  const signal = { cancel: false };
  const abortController = new AbortController();

  function cancelUpload() {
    signal.cancel = true;
    abortController.abort();
  }

  const promise = new Promise(function (resolve, reject) {
    uploadFileAsync(identifier, filename, localUri, onProgress, signal, abortController, resolve, reject);
  });

  return [promise, cancelUpload];
}

async function uploadFileAsync(identifier, filename, localUri, onProgress, signal, abortController, resolve, reject) {
  try {
    const [uploadId, key, parts] = await initUpload(identifier, filename, localUri);

    for (const part of parts) {
      if (signal.cancel) {
        reject({ message: "Canceled by user!" });
        return;
      }

      // TODO: If file is smaller than PART_SIZE or this is the last part of the file
      // we always have a smaller size here! Right now, the file is always reuploaded
      // in that case.
      if (part.size === PART_SIZE) continue;

      await uploadPart(part, uploadId, key, localUri, onProgress, abortController);
    }

    const publicUrl = await finalizeUpload(uploadId, key);
    resolve(publicUrl);
  } catch (err) {
    reject(err);
  }
}

async function initUpload(identifier, filename, localUri) {
  const {
    data: { uploadId, key, parts: existingParts },
  } = await HttpService.post(INIT_UPLOAD_API_URL, {
    identifier: identifier,
    filename: filename,
  });

  const fileSize = await getFileSize(localUri);
  const totalParts = Math.ceil(fileSize / PART_SIZE);
  const parts = [];

  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    const part = { partNumber: partNumber };
    const existingPart = existingParts.find((p) => p.partNumber == partNumber);
    parts.push({ ...part, ...existingPart });
  }

  return [uploadId, key, parts];
}

async function uploadPart(part, uploadId, key, localUri, onProgress, abortController) {
  console.log("Uploading part", part);

  // read binary data part from the source file
  const partData = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
    length: PART_SIZE,
    position: PART_SIZE * (part.partNumber - 1),
  });

  // get presigned url for part upload
  const {
    data: { presignedUrl },
  } = await HttpService.post(PREPARE_UPLOAD_PART_API_URL, {
    uploadId: uploadId,
    key: key,
    partNumber: part.partNumber,
  });

  const httpOptions = {
    headers: {
      "Content-Type": "application/octet-stream; charset=utf-8",
    },
    // TODO: To show a upload progress with bytes uploaded we would need to
    // take into account the total size of all chunks and already uploaded chunks
    onUploadProgress: (progressEvent) => {
      const { loaded, total } = progressEvent;
      onProgress(Math.floor((loaded * 100) / total));
    },
    signal: abortController.signal,
  };

  const response = await HttpService.put(presignedUrl, Buffer.from(partData, "base64"), httpOptions);

  part.etag = response.headers["etag"];
  // console.log("part uploaded!", part);
}

// // Added uploadPart implementation using uploadAsync that allows for background uploading
// // While this will finish to upload the part that is currently uploading when the
// // app is switched to background the whole background uploader still does not upload in background.
// // The app must be opened. See comment on src/components/AssetBackgroundUploader/BackgroundUploader.jsx
// async function uploadPart(part, uploadId, key, localUri, onProgress, abortController) {
//   console.log("Uploading part", part);

//   // get presigned url for part upload
//   const {
//     data: { presignedUrl },
//   } = await HttpService.post(PREPARE_UPLOAD_PART_API_URL, {
//     uploadId: uploadId,
//     key: key,
//     partNumber: part.partNumber,
//   });

//   // read binary data part from the source file
//   const partData = await FileSystem.readAsStringAsync(localUri, {
//     encoding: FileSystem.EncodingType.Base64,
//     length: PART_SIZE,
//     position: PART_SIZE * (part.partNumber - 1),
//   });

//   // Save part data to part file (FileSystem.uploadAsync can only upload local files)
//   await FileSystem.makeDirectoryAsync(PART_FILE_TEMP_DIR, { intermediates: true });
//   const partFileUri = `${PART_FILE_TEMP_DIR}${uuid.v4()}`;

//   await FileSystem.writeAsStringAsync(partFileUri, partData, {
//     encoding: FileSystem.EncodingType.Base64,
//   });

//   try {
//     const response = await FileSystem.uploadAsync(presignedUrl, partFileUri, {
//       httpMethod: "PUT",
//       sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
//       headers: {
//         "Content-Type": "application/octet-stream; charset=utf-8",
//       },
//     });

//     part.etag = response.headers["Etag"];
//     // console.log("part uploaded!", part);
//   } catch (err) {
//     throw err;
//   } finally {
//     FileSystem.deleteAsync(partFileUri, { idempotent: true });
//   }
// }

async function finalizeUpload(uploadId, key) {
  const {
    data: { publicUrl },
  } = await HttpService.post(FINALIZE_UPLOAD_API_URL, {
    uploadId: uploadId,
    key: key,
  });

  // console.log("Upload complete!", publicUrl);
  return publicUrl;
}
