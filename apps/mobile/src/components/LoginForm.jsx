import { useState, useTransition } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import ListDivider from '@/components/ListDivider';
import PrimaryButton from '@/components/PrimaryButton';
import TextButton from '@/components/TextButton';
import useCloud from '@/features/cloud/useCloud';
import { colors, radii, scale, spacing } from '@/styles/designTokens';
import isBlank from '@/utils/isBlank';

// `ownerEmail`: the account this library belongs to, pre-filled and kept until the user asks to sign
// in as someone else (which opens that account's own library instead).
export default function LoginForm({ ownerEmail }) {
  const [email, setEmail] = useState(ownerEmail ?? process.env.EXPO_PUBLIC_LOGIN_FORM_EMAIL);
  const [password, setPassword] = useState(process.env.EXPO_PUBLIC_LOGIN_FORM_PASSWORD);
  const [isOwnerEmail, setIsOwnerEmail] = useState(Boolean(ownerEmail));
  const { loginAsync } = useCloud();
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (isBlank(email) || isBlank(password)) {
      Alert.alert('Please enter email and password');
      return;
    }

    startTransition(async () => {
      try {
        await loginAsync(email, password);
      } catch (error) {
        Alert.alert("Couldn't sign in", error.message);
      }
    });
  }

  function handleSomeoneElse() {
    setIsOwnerEmail(false);
    setEmail('');
  }

  return (
    <>
      <View style={styles.section}>
        <TextInput
          style={[styles.input, isOwnerEmail && styles.inputLocked]}
          onChangeText={setEmail}
          value={email}
          editable={!isOwnerEmail}
          placeholder="Email"
          placeholderTextColor={colors.textTertiary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />
        <ListDivider />
        <TextInput
          style={styles.input}
          onChangeText={setPassword}
          value={password}
          placeholder="Password"
          placeholderTextColor={colors.textTertiary}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
      </View>

      <PrimaryButton label="Sign In" onPress={handleSubmit} loading={isPending} />

      {isOwnerEmail && <TextButton label="Sign in as someone else" onPress={handleSomeoneElse} />}
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.glassSurface,
    borderRadius: radii.card,
    overflow: 'hidden',
    marginBottom: 16,
  },
  input: {
    height: spacing.iconButtonSize,
    paddingHorizontal: spacing.floatingBarSide,
    fontSize: scale(16),
    color: colors.text,
  },
  inputLocked: {
    color: colors.textSecondary,
  },
});
