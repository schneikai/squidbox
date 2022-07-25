import { View, Pressable, Text } from "react-native";
import buttonStyles from "styles/buttonStyles";
import modalHeaderStyles from "styles/modalHeaderStyles";

export default function Header({ onCancel }) {
  return (
    <View style={modalHeaderStyles.container}>
      <View style={[modalHeaderStyles.columns, modalHeaderStyles.leftColumn]}>
        <Pressable onPress={onCancel} style={buttonStyles.headerButton}>
          <Text style={buttonStyles.headerButtonText}>Cancel</Text>
        </Pressable>
      </View>
      <View style={[modalHeaderStyles.columns, modalHeaderStyles.centerColumn]}>
        <Text style={modalHeaderStyles.headerLabel}>Albums</Text>
      </View>
      <View style={[modalHeaderStyles.columns, modalHeaderStyles.rightColumn]}></View>
    </View>
  );
}
