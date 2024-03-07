import AsyncStorage from '@react-native-async-storage/async-storage';

export default async function setUserAsync(data) {
  return AsyncStorage.setItem('user', JSON.stringify(data));
}
