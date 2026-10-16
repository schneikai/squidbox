import AsyncStorage from '@react-native-async-storage/async-storage';

import { CHAT_STORAGE_KEY } from './aiSuggestionsStorage';

/** Stores the AI chat with its style-reference posts, so later turns and app restarts reuse the same ones. */
export default function saveChatHistory(messages, referencePosts) {
  return AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ messages, referencePosts }));
}
