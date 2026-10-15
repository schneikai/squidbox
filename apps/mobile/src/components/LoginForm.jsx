import { useState, useTransition } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import useCloud from '@/features/cloud/useCloud';
import actionButtonStyles from '@/styles/actionButtonStyles';
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
        Alert.alert('Authentication failed!', error.message);
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

      {isOwnerEmail && (
        <TouchableOpacity style={styles.link} onPress={handleSomeoneElse} hitSlop={8}>
          <Text style={styles.linkText}>Sign in as someone else</Text>
        </TouchableOpacity>
      )}
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
  link: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  linkText: {
    color: colors.accent,
    fontSize: scale(15),
    fontWeight: '500',
  },
});
