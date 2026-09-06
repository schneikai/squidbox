import AsyncStorage from '@react-native-async-storage/async-storage';

export default async function getUserAsync() {
  const user = await AsyncStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}
