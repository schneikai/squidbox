import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_MODEL, MODEL_STORAGE_KEY } from './aiSuggestionsStorage';
import isSupportedModel from './isSupportedModel';

/** The model the AI suggestions use: the stored choice if they can use it, otherwise the default. */
export default async function resolveModel() {
  const stored = await AsyncStorage.getItem(MODEL_STORAGE_KEY);
  if (!stored) return DEFAULT_MODEL;
  if (isSupportedModel(stored)) return stored;
  // Forget an unsupported choice, so every screen shows and uses the default from now on.
  await AsyncStorage.removeItem(MODEL_STORAGE_KEY);
  return DEFAULT_MODEL;
}
