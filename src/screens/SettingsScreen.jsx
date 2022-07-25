import { StyleSheet, SafeAreaView, Text, View } from "react-native";
import { Status as AssetBackgroundUploaderStatus } from "components/AssetBackgroundUploader";

export default function SettingsScreen({ route, navigation }) {
  return (
    <SafeAreaView>
      <View style={styles.container}>
        <Text>Settings</Text>
        <AssetBackgroundUploaderStatus />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
});
