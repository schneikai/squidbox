import { useEffect, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Status as AssetBackgroundUploaderStatus } from "components/AssetBackgroundUploader";
import { setStatusBarHidden } from "expo-status-bar";

export default function SyncScreen({ navigation, route }) {
  const [contentTop, setContentTop] = useState("50%");
  const [contentLeft, setContentLeft] = useState("50%");

  useEffect(() => {
    setStatusBarHidden(true, "fade");

    const intervalId = setInterval(() => {
      setContentTop(`${Math.floor(Math.random() * 80) + 10}%`);
      setContentLeft(`${Math.floor(Math.random() * 80) + 10}%`);
    }, 6000);

    return () => {
      clearInterval(intervalId);
      setStatusBarHidden(false, "fade");
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.content, { top: contentTop, left: contentLeft }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <AssetBackgroundUploaderStatus style={{ opacity: 0.25 }} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "black",
    flex: 1,
  },
  content: {
    position: "absolute",
  },
});
