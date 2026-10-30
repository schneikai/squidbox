import { useState, useTransition } from 'react';
import { Alert, StyleSheet } from 'react-native';

import Button from '@/components/Button';
import TextInput from '@/components/TextInput';
import { Section } from '@/components/settings-list/SettingsList';
import useCloud from '@/features/cloud/useCloud';
import { colors, layout, sizes } from '@/styles/designTokens';
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
      <Section>
        <TextInput
          style={[styles.input, isOwnerEmail && styles.inputLocked]}
          onChangeText={setEmail}
          value={email}
          editable={!isOwnerEmail}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />
        <TextInput
          style={styles.input}
          onChangeText={setPassword}
          value={password}
          placeholder="Password"
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
      </Section>

      <Button variant="primary" label="Sign In" onPress={handleSubmit} loading={isPending} style={styles.submit} />

      {isOwnerEmail && <Button label="Sign in as someone else" onPress={handleSomeoneElse} />}
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    height: sizes.iconButton,
    paddingHorizontal: layout.sideGutter, // ListDivider's inset
  },
  submit: {
    marginTop: 12,
  },
  inputLocked: {
    color: colors.text.secondary,
  },
});
