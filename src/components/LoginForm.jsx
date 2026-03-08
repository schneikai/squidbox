import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import confirmLoginAsync from '@/features/cloud/confirmLoginAsync';
import useCloud from '@/features/cloud/useCloud';
import isBlank from '@/utils/isBlank';

export default function LoginForm() {
  const [email, setEmail] = useState(process.env.EXPO_PUBLIC_LOGIN_FORM_EMAIL);
  const [password, setPassword] = useState(process.env.EXPO_PUBLIC_LOGIN_FORM_PASSWORD);
  const { loginAsync } = useCloud();
  const { showBlocking, hide: hideOverlay } = useProgressOverlay();

  async function handleSubmit() {
    if (isBlank(email) || isBlank(password)) {
      Alert.alert('Please enter email and password');
      return;
    }

    const confirmed = await confirmLoginAsync();
    if (!confirmed) return;

    showBlocking();
    try {
      await loginAsync(email, password);
    } catch (error) {
      Alert.alert('Authentication failed!', error.message);
    } finally {
      hideOverlay();
    }
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
      <TouchableOpacity style={styles.loginButton} onPress={handleSubmit}>
        <Text style={styles.loginButtonText}>Sign In</Text>
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
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
