import { useState, useTransition } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import confirmLoginAsync from '@/features/cloud/confirmLoginAsync';
import useCloud from '@/features/cloud/useCloud';
import isBlank from '@/utils/isBlank';

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

      {/* Input fields */}
      <View style={styles.section}>
        <TextInput
          style={styles.input}
          onChangeText={setEmail}
          value={email}
          placeholder="Email"
          placeholderTextColor="#C7C7CC"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />
        <View style={styles.divider} />
        <TextInput
          style={styles.input}
          onChangeText={setPassword}
          value={password}
          placeholder="Password"
          placeholderTextColor="#C7C7CC"
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
      </View>

      {/* Login button */}
      <TouchableOpacity style={[styles.loginButton, isPending && styles.loginButtonDisabled]} onPress={handleSubmit} disabled={isPending}>
        {isPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.loginButtonText}>Sign In</Text>
        )}
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 16,
  },
  input: {
    height: 44,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C6C6C8',
    marginLeft: 16,
  },
  loginButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
