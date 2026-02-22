const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
export const REFERENCE_POST_COUNT = 50;

export { DEFAULT_MODEL } from './aiSuggestionsStorage';

const FORMAT_INSTRUCTION = 'Always respond with a raw JSON array of strings and nothing else. Example: ["text one", "text two"]';

function buildSystemPrompt(recentPostTexts) {
  const referencePart =
    recentPostTexts.length > 0
      ? `Here are the user's ${recentPostTexts.length} most recent posts for reference:\n${recentPostTexts.map((text, i) => `${i + 1}. ${text}`).join('\n')}\n\n`
      : '';

  return `${referencePart}${FORMAT_INSTRUCTION}`;
}

/**
 * Tries to extract an array of strings from whatever the model returns.
 * Handles: JSON arrays, numbered lists, blank-line-separated blocks.
 */
function parseResponse(content) {
  // 1. Try straight JSON parse
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {}

  // 2. Try extracting a JSON array from within the response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {}
  }

  // 3. Numbered list: "1. text", "1) text"
  const numberedLines = [...content.matchAll(/^\s*\d+[.)]\s+(.+)/gm)].map((m) => m[1].trim());
  if (numberedLines.length > 0) return numberedLines.filter(Boolean);

  // 4. Dash / bullet list: "- text", "• text"
  const bulletLines = [...content.matchAll(/^\s*[-•*]\s+(.+)/gm)].map((m) => m[1].trim());
  if (bulletLines.length > 0) return bulletLines.filter(Boolean);

  // 5. Blank-line-separated paragraphs
  const paragraphs = content.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;

  // 6. Plain line-by-line
  const lines = content.split('\n').map((s) => s.trim()).filter(Boolean);
  if (lines.length > 0) return lines;

  return [content.trim()];
}

/**
 * Sends a message to the OpenAI chat completions API and returns the suggestions.
 *
 * @param {Array<{role: string, content: string}>} messages - Full chat history.
 * @param {string[]} recentPostTexts - Recent posts for reference (empty = disabled).
 * @param {string} model - The OpenAI model ID to use.
 * @returns {Promise<string[]>} Parsed array of suggestion strings.
 */
export default async function sendAiMessageAsync(messages, recentPostTexts, model) {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey || apiKey === 'sk-...') {
    throw new Error('OpenAI API key not configured. Set EXPO_PUBLIC_OPENAI_API_KEY in .env.local.');
  }

  const systemPrompt = buildSystemPrompt(recentPostTexts);
  const messagesPayload = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messagesPayload,
      temperature: 0.9,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message ?? `OpenAI request failed (${response.status})`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  if (!content) throw new Error('Empty response from AI.');

  return parseResponse(content);
}
