import { StyleSheet, View, Pressable, Text } from "react-native";
import buttonStyles from "styles/buttonStyles";
import modalHeaderStyles from "styles/modalHeaderStyles";

export default function Header({ library, onCancel, toggleLibrary, onSelect }) {
  return (
    <View style={modalHeaderStyles.container}>
      <View style={[modalHeaderStyles.columns, modalHeaderStyles.leftColumn]}>
        <Pressable onPress={onCancel} style={buttonStyles.headerButton}>
          <Text style={buttonStyles.headerButtonText}>Cancel</Text>
        </Pressable>
      </View>
      <View style={[modalHeaderStyles.columns, modalHeaderStyles.centerColumn]}>
        <Pressable style={styles.toggle} onPress={toggleLibrary}>
          <View style={[styles.toggleSwitch, library === "assets" && styles.toggleSwitchActive]}>
            <Text>Photos</Text>
          </View>
          <View style={[styles.toggleSwitch, library === "albums" && styles.toggleSwitchActive]}>
            <Text>Albums</Text>
          </View>
        </Pressable>
      </View>
      <View style={[modalHeaderStyles.columns, modalHeaderStyles.rightColumn]}>
        <Pressable onPress={onSelect} style={buttonStyles.headerButton}>
          <Text style={buttonStyles.headerButtonText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: "row",
    padding: 2,
    backgroundColor: "lightgrey",
    borderRadius: 5,
  },
  toggleSwitch: {
    borderRadius: 5,
    padding: 2,
    paddingHorizontal: 6,
  },
  toggleSwitchActive: {
    backgroundColor: "white",
  },
});
