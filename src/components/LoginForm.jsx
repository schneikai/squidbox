import { useState } from 'react';
import { StyleSheet, View, Alert, TextInput } from 'react-native';

import BlockingModal from '@/components/BlockingModal';
import { Button } from '@/components/Buttons';
import confirmLoginAsync from '@/features/cloud/confirmLoginAsync';
import useCloud from '@/features/cloud/useCloud';
import isBlank from '@/utils/isBlank';

export default function LoginForm() {
  const [email, setEmail] = useState(process.env.EXPO_PUBLIC_LOGIN_FORM_EMAIL);
  const [password, setPassword] = useState(process.env.EXPO_PUBLIC_LOGIN_FORM_PASSWORD);
  const { loginAsync } = useCloud();
  const [blockerVisible, setBlockerVisible] = useState(false);

  async function handleSubmit() {
    if (isBlank(email) || isBlank(password)) {
      Alert.alert('Please enter email and password');
      return;
    }

    // TODO: Add code to merge existing local data json files with the
    // json data from the cloud.
    // If there is no local data we can skip the confirmation all together.
    const confirmed = await confirmLoginAsync();
    if (!confirmed) return;

    setBlockerVisible(true);

    try {
      await loginAsync(email, password);

      // TODO: If there is no assets in the app locally
      // load data from the server. If there is assets locally
      // we can either replace it with cloud data or merge it.

      // For merging we need to compare the updatedAt field
      // and use the most recent one.
    } catch (error) {
      Alert.alert('Authentication failed!', error.message);
    } finally {
      setBlockerVisible(false);
    }
  }

  return (
    <>
      <BlockingModal visible={blockerVisible} />
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          onChangeText={setEmail}
          value={email}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          onChangeText={setPassword}
          value={password}
          placeholder="Password"
          secureTextEntry
        />
        <Button onPress={handleSubmit} title="Login" style={{ marginTop: 10 }} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'lightgray',
  },
  input: {
    width: '100%',
    margin: 12,
    borderWidth: 1,
    padding: 10,
  },
});
