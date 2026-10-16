import readVariations from './readVariations';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Every chat reply is a set to choose from, also for corrections; the schema enforces it.
const MIN_CHAT_VARIATIONS = 3;

const CHAT_RULES = [
  `- Every reply is a set of alternative posts for the user to choose from. Give at least ${MIN_CHAT_VARIATIONS}.`,
  '- When the user asks for changes, apply them to the posts from your previous reply and return the complete revised set, never just one post. If the change is about one of the posts, return several revised versions of that post.',
];

const ITEM_RULE =
  '- Each item is only the finished post text: no numbering, labels, surrounding quotes, commentary, Markdown, code or JSON.';

// A chat reply, or with `batchSize` a batch of independent posts.
function replyFormat(batchSize) {
  if (!batchSize) {
    return { rules: CHAT_RULES, itemCount: { minItems: MIN_CHAT_VARIATIONS }, requiredCount: MIN_CHAT_VARIATIONS };
  }
  return {
    rules: [
      `- Reply with exactly ${batchSize} posts.`,
      '- Each post stands on its own: independent, varied posts with different topics and angles, not alternatives or rewrites of one post.',
    ],
    itemCount: { minItems: batchSize, maxItems: batchSize },
    // A batch with an unusable item still has posts to show.
    requiredCount: 1,
  };
}

function responseFormat(itemCount) {
  return {
    type: 'json_schema',
    json_schema: {
      name: 'post_variations',
      strict: true,
      schema: {
        type: 'object',
        properties: { variations: { type: 'array', ...itemCount, items: { type: 'string' } } },
        required: ['variations'],
        additionalProperties: false,
      },
    },
  };
}

function buildSystemPrompt(referencePosts, customSystemPrompt, rules) {
  const parts = [];
  if (customSystemPrompt?.trim()) parts.push(customSystemPrompt.trim());
  if (referencePosts.length > 0) {
    parts.push(
      `Here are some of your past tweets as reference for tone and style:\n${referencePosts
        .map((text, i) => `${i + 1}. ${text}`)
        .join('\n')}`,
    );
  }
  // After the user's editable persona prompt, so a custom prompt can't change the reply format.
  parts.push(['How to reply (set by the app, always applies):', ...rules, ITEM_RULE].join('\n'));
  return parts.join('\n\n');
}

function toApiMessage(message) {
  if (message.role !== 'assistant') return message;
  return { role: 'assistant', content: JSON.stringify({ variations: message.variations }) };
}

function readReply({ message = {}, finish_reason: finishReason }, requiredCount) {
  if (message.refusal) throw new Error(`The AI declined: ${message.refusal}`);
  if (finishReason === 'length') {
    throw new Error('The reply was too long and got cut off. Please try again, or ask for something shorter.');
  }
  if (finishReason === 'content_filter') {
    throw new Error("The reply was blocked by OpenAI's content filter. Please rephrase your request.");
  }
  try {
    const variations = readVariations(JSON.parse(message.content).variations, requiredCount);
    if (variations) return variations;
  } catch {}
  throw new Error("The AI's reply couldn't be read. Please try again.");
}

/**
 * Sends the chat to the OpenAI chat completions API and returns the post variations.
 *
 * @param {Array<{role: 'user', content: string} | {role: 'assistant', variations: string[]}>} messages
 * @param {string[]} referencePosts - Past posts for style reference (empty = disabled).
 * @param {string} model - The OpenAI model ID to use.
 * @param {string} [customSystemPrompt] - Optional persona / instructions prepended to the system prompt.
 * @param {{batchSize?: number}} [options] - `batchSize`: ask for exactly that many independent posts instead
 *   of a chat reply with alternatives to choose from.
 * @returns {Promise<string[]>} The variations, plain post texts.
 */
export default async function sendAiMessageAsync(
  messages,
  referencePosts,
  model,
  customSystemPrompt,
  { batchSize } = {},
) {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey || apiKey === 'sk-...') {
    throw new Error('OpenAI API key not configured. Set EXPO_PUBLIC_OPENAI_API_KEY in .env.local.');
  }
  const format = replyFormat(batchSize);

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt(referencePosts, customSystemPrompt, format.rules) },
        ...messages.map(toApiMessage),
      ],
      response_format: responseFormat(format.itemCount),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message ?? `OpenAI request failed (${response.status})`);
  }

  const data = await response.json();
  return readReply(data.choices?.[0] ?? {}, format.requiredCount);
}
