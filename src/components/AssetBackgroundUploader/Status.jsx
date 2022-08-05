import { useContext } from "react";
import { StyleSheet, View, Text, Button } from "react-native";
import { Context } from "components/AssetBackgroundUploader/Context";
import { getAllAssets, updateAsset } from "services/AssetDataService";

export default function Status({ style }) {
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

  return (
    <View style={[styles.container, style]}>
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

      {/* <Text>{JSON.stringify(state)}</Text> */}
      <Text>{state.statusMessage}</Text>
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
