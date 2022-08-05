import { StyleSheet, SafeAreaView, Text, View, Button } from "react-native";
import { Status as AssetBackgroundUploaderStatus } from "components/AssetBackgroundUploader";

export default function SettingsScreen({ route, navigation }) {
  function navigateToSyncScreen() {
    navigation.navigate("Sync");
  }

  return (
    <SafeAreaView>
      <View style={styles.container}>
        <Text>Settings</Text>
        <AssetBackgroundUploaderStatus />
        <Button onPress={navigateToSyncScreen} title="Open Dark Screen" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
});
