import AsyncStorage from '@react-native-async-storage/async-storage';

import { CHAT_STORAGE_KEY } from './aiSuggestionsStorage';
import readVariations from './readVariations';

// Removes the array look from an old reply that isn't valid JSON, e.g. ['Morning coffee vibes'].
function unwrapRawReply(content) {
  return content
    .trim()
    .replace(/^\[\s*/, '')
    .replace(/\s*\]$/, '')
    .replace(/^(['"])([\s\S]*)\1$/, '$2');
}

// Replies were once stored as `content` holding a JSON array. One that can't be read is kept as a
// single variation of its raw text, so no reply is lost.
function readOldReply(content) {
  try {
    const items = JSON.parse(content);
    if (Array.isArray(items) && items.every((item) => typeof item === 'string')) return readVariations(items);
  } catch {}
  return readVariations([unwrapRawReply(String(content ?? ''))]);
}

// A reply without any text left is dropped: there is nothing to show or send back.
function toCurrentMessage(message) {
  if (message.role !== 'assistant') return message;
  const variations = message.variations ? readVariations(message.variations) : readOldReply(message.content);
  return variations && { role: 'assistant', variations };
}

/**
 * The AI chat stored under CHAT_STORAGE_KEY: its messages and the style-reference posts drawn when it
 * started (`[]` when the user opted out, null when none were drawn yet).
 */
export default async function readChatHistory() {
  const stored = JSON.parse((await AsyncStorage.getItem(CHAT_STORAGE_KEY)) ?? 'null');
  // Older versions stored only the messages.
  const chat = Array.isArray(stored) ? { messages: stored } : (stored ?? {});
  return {
    messages: (chat.messages ?? []).map(toCurrentMessage).filter(Boolean),
    referencePosts: Array.isArray(chat.referencePosts) ? chat.referencePosts : null,
  };
}
