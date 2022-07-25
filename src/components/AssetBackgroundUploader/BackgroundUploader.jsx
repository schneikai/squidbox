import { useContext, useEffect, useRef, useState } from "react";
import { Context } from "components/AssetBackgroundUploader/Context";
import { getAssetsForUpload, updateAsset } from "services/AssetDataService";
import * as MultipartFileUploader from "services/MultipartFileUploader";
import { uploadFile } from "services/FileUploader";
import { getTimestamp } from "services/TimeService";
import { getFileExtension } from "services/FileService";
import { deleteAsync } from "expo-file-system";

// Unfortunately we cannot use Firebase Storage for hosting the files.
// The uploader (uploadBytesResumable) only supports uploading from
// a binary blob and for very large files it is not possible to load
// all that data into memory!

// I use MultipartFileUploader now that talks to a small Rails API
// and allows to upload chunked files to Amazon S3.

const MAIN_LOOP_INTERVAL_LENGTH = 2 * 1000;
const WAIT_IF_NO_ASSETS = 6 * 1000; // TODO: Maybe use a minute or more in production

export default function BackgroundUploader() {
  const { state, dispatch } = useContext(Context);
  const [loopInterval, setLoopInterval] = useState();
  const assetsRef = useRef([]);
  const cancelUploadRef = useRef(null);
  const mainLoopRunningRef = useRef(false);

  // BackgroundUploader uses a main loop that continually checks for
  // assets and uploads them to the cloud storage.

  // It was a little bit complicated to create that loop. A simple
  // javascript loop or interval function did not work with the React
  // internals very well. Inside the loop I could only access the state
  // as it was when the function was first called. Later state updates
  // did not show up inside that function.
  // I use a interval now that updates a state variable (loopInterval)
  // and I use that to trigger a useEffect that runs the main loop.
  // It is important that the main loop function is called with all
  // dependencies from inside useEffect to have the lates state updates
  // available inside the function.

  // TODO: Apparently setInterval does not work when App is in background :(
  // https://stackoverflow.com/questions/51997866/react-native-setinterval-getting-paused-when-app-is-in-background
  // We can try and checkout Expo BackgroundFetch
  // https://docs.expo.dev/versions/latest/sdk/background-fetch/?redirected
  // or TaskManager
  // https://docs.expo.dev/versions/latest/sdk/task-manager/

  useEffect(() => {
    const intervalId = setInterval(() => {
      setLoopInterval(getTimestamp());
    }, MAIN_LOOP_INTERVAL_LENGTH);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (mainLoopRunningRef.current) return;
    if (state.isPaused) return;

    // TODO: We need code here that checks if we have internet connection
    const isOnline = true;
    if (!isOnline) return;

    mainLoop(
      mainLoopRunningRef,
      assetsRef,
      cancelUploadRef,
      onProgress,
      setTotalNumberToUpload,
      incrementCurrentNumberToUpload
    );
  }, [loopInterval]);

  useEffect(() => {
    if (state.isPaused && cancelUploadRef.current) {
      cancelUploadRef.current();
      cancelUploadRef.current = null;
    }
  }, [state.isPaused]);

  // This is not used yet. Check comment in MultipartFileUploader
  function onProgress(percent) {
    console.log(`Uploading ${percent}%`);
  }

  function setTotalNumberToUpload(totalNumber) {
    dispatch({
      type: "setCurrentNumber",
      payload: 1,
    });
    dispatch({
      type: "setTotalNumber",
      payload: totalNumber,
    });
  }

  function incrementCurrentNumberToUpload() {
    dispatch({
      type: "incrementCurrentNumber",
    });
  }

  return <></>;
}

async function mainLoop(
  mainLoopRunningRef,
  assetsRef,
  cancelUploadRef,
  onProgress,
  setTotalNumberToUpload,
  incrementCurrentNumberToUpload
) {
  mainLoopRunningRef.current = true;

  try {
    console.log("BackgroundUploader::MainLoop", getTimestamp());

    if (!assetsRef.current.length) {
      console.log("Loading assets for upload!");
      assetsRef.current = await getAssetsForUpload();
      setTotalNumberToUpload(assetsRef.current.length);
    }

    const asset = assetsRef.current.pop();

    if (!asset) {
      await sleep(WAIT_IF_NO_ASSETS);
      mainLoopRunningRef.current = false;
      return;
    }

    const [fileUrl, thumbnailUrl] = await uploadAsset(asset, cancelUploadRef, onProgress);

    // I decided to not unset the fileUri since as long as it exists
    // on the device we don't need to download it from the internet.
    await updateAsset(asset.id, {
      fileUrl: fileUrl,
      thumbnailUrl: thumbnailUrl,
      thumbnailUri: null,
      isUploaded: true,
    });

    // Thumbnail now exists online and we don't need it locally anymore.
    await deleteAsync(asset.thumbnailUri, { idempotent: true });

    incrementCurrentNumberToUpload();
  } catch (err) {
    // try {
    //   // TODO: Try to save error info for that asset to avoid sending data over and over.
    //   // Save locally since there might be a problem with updating the asset itself.
    //   // Use some exponential backoff to retry upload for this asset.
    //   // If we fail to save the error info we need to quit the sync!
    // } catch (err) {
    //   throw("Failed to save error info! Exiting main loop! Sorry!")
    // }
    console.log("Upload failed!", err);
  } finally {
    mainLoopRunningRef.current = false;
  }
}

async function uploadAsset(asset, cancelUploadRef, onProgress) {
  console.log("Starting asset upload...", asset.id, getTimestamp());

  // Upload thumbnail
  const thumbnailFilename = `${asset.id}_thumbnail.${getFileExtension(asset.thumbnailUri)}`;
  const thumbnailUrl = await uploadFile(thumbnailFilename, asset.thumbnailUri);

  // Upload main file
  const [uploadFilePromise, cancelUpload] = MultipartFileUploader.uploadFile(
    asset.id,
    asset.filename,
    asset.fileUri,
    onProgress
  );

  cancelUploadRef.current = cancelUpload;
  const fileUrl = await uploadFilePromise;

  console.log("Finished asset upload!", asset.id, getTimestamp());
  return [fileUrl, thumbnailUrl];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
