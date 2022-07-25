import { StyleSheet, View, Pressable, Text } from "react-native";
import * as Linking from "expo-linking";

export default function PermissionRequired() {
  return (
    <View style={styles.container}>
      <Text>Please allow this app access to your photos library.</Text>
      <Pressable onPress={() => Linking.openSettings()}>
        <Text>Open Settings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: "center",
  },
});
