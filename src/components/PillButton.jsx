import { useEffect, useState } from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';

export default function PillButton({
  activeButtonLabel,
  leftButtonLabel,
  leftButtonOnPress,
  rightButtonLabel,
  rightButtonOnPress,
}) {
  const [activeButton, setActiveButton] = useState(activeButtonLabel || leftButtonLabel);

  useEffect(() => {
    if (activeButtonLabel) setActiveButton(activeButtonLabel);
  }, [activeButtonLabel]);

  function pressLeftButton() {
    if (!activeButtonLabel) setActiveButton(leftButtonLabel);
    leftButtonOnPress();
  }

  function pressRightButton() {
    if (!activeButtonLabel) setActiveButton(rightButtonLabel);
    rightButtonOnPress();
  }

  return (
    <View style={styles.pillButton}>
      <Pressable
        style={[styles.button, activeButton === leftButtonLabel && styles.buttonActive]}
        onPress={pressLeftButton}
      >
        <Text style={styles.buttonLabel}>{leftButtonLabel}</Text>
      </Pressable>
      <Pressable
        style={[styles.button, activeButton === rightButtonLabel && styles.buttonActive]}
        onPress={pressRightButton}
      >
        <Text style={styles.buttonLabel}>{rightButtonLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pillButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#eee',
    borderRadius: 8,
    padding: 2,
  },
  button: {
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  buttonActive: {
    backgroundColor: 'white',
    elevation: 2, // Android
    shadowColor: '#000', // iOS
    shadowOffset: { width: 0, height: 1 }, // iOS
    shadowOpacity: 0.2, // iOS
    shadowRadius: 2, // iOS
  },
  buttonLabel: {
    fontSize: 14,
  },
});
