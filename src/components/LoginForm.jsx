import { useState, useTransition } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import confirmLoginAsync from '@/features/cloud/confirmLoginAsync';
import useCloud from '@/features/cloud/useCloud';
import isBlank from '@/utils/isBlank';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, radii, scale, spacing } from '@/styles/designTokens';

export default function LoginForm() {
  const [email, setEmail] = useState(process.env.EXPO_PUBLIC_LOGIN_FORM_EMAIL);
  const [password, setPassword] = useState(process.env.EXPO_PUBLIC_LOGIN_FORM_PASSWORD);
  const { loginAsync } = useCloud();
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (isBlank(email) || isBlank(password)) {
      Alert.alert('Please enter email and password');
      return;
    }

    startTransition(async () => {
      const confirmed = await confirmLoginAsync();
      if (!confirmed) return;

      try {
        await loginAsync(email, password);
      } catch (error) {
        Alert.alert('Authentication failed!', error.message);
      }
    });
  }

  return (
    <>
      <View style={styles.section}>
        <TextInput
          style={styles.input}
          onChangeText={setEmail}
          value={email}
          placeholder="Email"
          placeholderTextColor={colors.textTertiary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />
        <View style={actionButtonStyles.listDivider} />
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

      <TouchableOpacity
        style={[styles.loginButton, isPending && styles.loginButtonDisabled]}
        onPress={handleSubmit}
        disabled={isPending}
      >
        {isPending ? (
          <ActivityIndicator color={colors.textInverse} />
        ) : (
          <Text style={styles.loginButtonText}>Sign In</Text>
        )}
      </TouchableOpacity>
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
  loginButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.card,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: colors.textInverse,
    fontSize: scale(16),
    fontWeight: '600',
  },
});
