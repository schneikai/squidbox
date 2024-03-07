import { Pressable, Text } from 'react-native';

import buttonStyles from '@/styles/buttonStyles';

export function Button({ title, onPress, disabled, variant = 'default', style = {} }) {
  const styles = {
    default: [buttonStyles.button, style],
    primary: [buttonStyles.button, buttonStyles.buttonPrimary, style],
    danger: [buttonStyles.button, buttonStyles.buttonDanger, style],
  };

  const textStyles = {
    default: buttonStyles.buttonText,
    primary: [buttonStyles.buttonText, buttonStyles.buttonPrimaryText],
    danger: [buttonStyles.buttonText, buttonStyles.buttonDangerText],
  };

  return (
    <Pressable style={styles[variant]} onPress={onPress} disabled={disabled}>
      <Text style={textStyles[variant]}>{title}</Text>
    </Pressable>
  );
}
