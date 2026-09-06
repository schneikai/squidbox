import { useEffect, useState } from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';

import { scale } from '@/styles/designTokens';

export default function SegmentedControl({
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
    <View style={styles.container}>
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
  container: {
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  buttonLabel: {
    fontSize: scale(14),
  },
});
