import { useContext } from "react";
import { StyleSheet, View, Text, Button } from "react-native";
import { Context } from "components/AssetBackgroundUploader/Context";
import { getAllAssets, updateAsset } from "services/AssetDataService";

export default function Status() {
  const { state, dispatch } = useContext(Context);

  function pauseUpload() {
    dispatch({
      type: "setIsPaused",
      payload: true,
    });
  }

  function resumeUpload() {
    dispatch({
      type: "setIsPaused",
      payload: false,
    });
  }

  async function resetAssetsSyncStatus() {
    const assets = await getAllAssets();
    for (const asset of assets) {
      await updateAsset(asset.id, {
        fileUrl: null,
        fileThumbnail: null,
        isUploaded: false,
      });
    }
  }

  return (
    <View style={styles.container}>
      {!state.isPaused && state.totalNumber > 0 && (
        <>
          <Text>
            Syncing {state.currentNumber} of {state.totalNumber}
          </Text>

          <Button onPress={pauseUpload} title="Pause Sync" />
        </>
      )}

      {!state.isPaused && state.totalNumber == 0 && <Text>All files synced! Yeah!</Text>}

      {state.isPaused && (
        <>
          <Text>Sync is paused!</Text>
          <Button onPress={resumeUpload} title="Resume Sync" />
        </>
      )}

      {/* {<Button onPress={resetAssetsSyncStatus} title="Reset Assets" />} */}

      {/* <Text>{JSON.stringify(state)}</Text> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    padding: 20,
    backgroundColor: "lightgrey",
  },
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
