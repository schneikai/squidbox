// The AI's prompts and the JSON each model must answer with.
import {
  chatReplyFieldsSchema,
  WRITING_TWEET_COUNT,
  type ChatContext,
  type ChatReply,
  type ChatTurn,
  type Instructions,
  type PersonaFields,
} from '@squidbox/shared';
import { z } from 'zod';
import type { ChatMessage, JsonSchemaSpec } from './venice.js';

/** Writing as the user: their "Writing as you" setup, or null before they saved one (persona.ts). */
export type Persona = PersonaFields | null;

/**
 * `template` with each `{name}` of `values` filled in (other braces stay as they are). The
 * instructions are the user's to edit, so a template may lack a placeholder or have an unknown one:
 * neither fails, the reply's schema and checks still hold the model to its format.
 */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? values[name]! : match));
}

// Only how a writing compare answers, not what it writes, so it isn't one of the editable
// instructions (the owner's call): the prompt box stays all the guidance a model gets. It names
// JSON: some providers behind Venice refuse a response format when the messages don't.
const COMPARE_WRITING_FORMAT =
  'Answer in JSON, with only the posts the prompt asks for. Each item is one finished post, with no intro, notes or quotes around it.';

// After the model's earlier posts, so New suggestions with the same prompt brings new ones.
const COMPARE_WRITE_DIFFERENT = 'Write different ones.';

// A vision compare's line on the answer's format, after the prompt box: a prompt about "each photo"
// had a model answer a list of photos.
const COMPARE_VISION_FORMAT = 'Answer in JSON, with the tags of this one photo.';

// After the model's earlier tags of the photo, so a new round with the same prompt brings new ones.
const COMPARE_TAG_DIFFERENT = 'Give different tags.';

/**
 * The writing prompt of a compare: the prompt box as the user's message, after a system line on the
 * answer's format only; the reply's JSON schema (postsSchema) asks for the posts alone. Each of
 * `earlierRounds` (the model's posts of its last rounds, oldest first) follows as its answer, then
 * asks for different ones.
 */
export function writingMessages(prompt: string, earlierRounds: string[][] = []): ChatMessage[] {
  return [
    { role: 'system', content: COMPARE_WRITING_FORMAT },
    { role: 'user', content: prompt },
    ...earlierRounds.flatMap((posts): ChatMessage[] => [
      { role: 'assistant', content: JSON.stringify({ posts }) },
      { role: 'user', content: COMPARE_WRITE_DIFFERENT },
    ]),
  ];
}

/**
 * The assistant chat, as the user: the writing briefing (`instructions.writing`, filled with their
 * persona, Favorites and the post) as the whole system message, then the transcript, a past reply in
 * the JSON the model replies in and a More like this turn as `instructions.moreLikeThis` with the
 * option after it.
 */
export function chatMessages({
  context,
  transcript,
  persona,
  favorites,
  instructions,
}: {
  context: ChatContext;
  transcript: ChatTurn[];
  persona: Persona;
  favorites: string[];
  instructions: Instructions;
}): ChatMessage[] {
  return [
    { role: 'system', content: writingBriefingText(instructions.writing, { persona, favorites, context }) },
    ...transcript.map((turn): ChatMessage =>
      turn.role === 'user'
        ? {
            role: 'user',
            content: turn.moreLikeThis ? `${instructions.moreLikeThis}\n\n${turn.content}` : turn.content,
          }
        : { role: 'assistant', content: JSON.stringify({ reply: turn.reply, postOptions: turn.postOptions }) },
    ),
  ];
}

// A reply as the judge reads it: its text, then its post options numbered.
function replyText({ reply, postOptions }: ChatReply): string {
  return [reply || '(no reply text)', ...postOptions.map((option, index) => `${index + 1}. ${option}`)].join('\n');
}

/**
 * Verify's judge question after a chat turn: `template` (instructions.modelCheckJudge)
 * filled with what the writing model was told about the creator and the post, with the writing
 * briefing's placeholders (the persona's facts, the posts they liked, none for a section without them,
 * and the post's media, photo tags, tagged people and caption), so a name, handle or tag it was given
 * never counts as invented; the turns before it (`{transcript}`, "Creator: …" and "Assistant: …" with its numbered
 * options, "(none)" on the first turn), the creator's last message (`{request}`) and the reply to
 * judge (`{reply}`), as the one message.
 */
export function judgeMessages({
  template,
  context,
  persona,
  favorites,
  transcript,
  request,
  reply,
}: {
  template: string;
  context: ChatContext;
  persona: Persona;
  favorites: string[];
  transcript: ChatTurn[];
  request: string;
  reply: ChatReply;
}): ChatMessage[] {
  const before = transcript.map((turn) =>
    turn.role === 'user' ? `Creator: ${turn.content}` : `Assistant: ${replyText(turn)}`,
  );
  const content = fillLines(template, {
    ...personaValues(persona),
    favorites: favoritesText(favorites),
    ...postValues(context),
    transcript: before.join('\n\n') || '(none)',
    request,
    reply: replyText(reply),
  });
  // A user message: a model behind Venice (Claude) refuses a request with only a system message.
  return [{ role: 'user', content }];
}

const PLACEHOLDER = /\{(\w+)\}/;

// A markdown heading ("# The creator"), not a line that starts with a hashtag.
const HEADING = /^#{1,6}\s/;

/**
 * `template` filled with `values`, where a line whose placeholder is empty goes, with a heading line
 * (one ending in ':', without a placeholder) right above it. Then a `#` heading left with nothing
 * under it before the next `#` heading or the end goes too, from the end up, so emptied sections go
 * one after the other; and blank lines left in a row become one. The result is trimmed.
 */
export function fillLines(template: string, values: Record<string, string>): string {
  const lines: string[] = [];
  for (const line of template.split('\n')) {
    const isEmpty = [...line.matchAll(/\{(\w+)\}/g)].some(([, name]) => name! in values && !values[name!]);
    if (!isEmpty) {
      lines.push(line);
      continue;
    }
    const above = lines[lines.length - 1];
    if (above !== undefined && above.trimEnd().endsWith(':') && !PLACEHOLDER.test(above)) lines.pop();
  }
  const kept: string[] = [];
  let isSectionEmpty = true; // nothing but blank lines since the next heading or the end
  for (const line of lines.reverse()) {
    if (HEADING.test(line)) {
      if (isSectionEmpty) continue;
      isSectionEmpty = true;
    } else if (line.trim()) {
      isSectionEmpty = false;
    }
    if (!line.trim() && kept.length > 0 && !kept[kept.length - 1]!.trim()) continue;
    kept.push(line);
  }
  return fillTemplate(kept.reverse().join('\n'), values).trim();
}

// The persona's own fields as template values: empty ones when there is none; rules as "- " lines.
function personaValues(persona: Persona): Record<string, string> {
  return {
    aboutYou: persona?.aboutYou ?? '',
    tone: persona?.tone ?? '',
    contentTags: persona?.contentTags.join(', ') ?? '',
    rules: persona?.rules.map((rule) => `- ${rule}`).join('\n') ?? '',
  };
}

// The Favorites' texts as "- " lines like the rules, each on one line.
function favoritesText(favorites: string[]): string {
  return favorites.map((post) => `- ${post.trim().replace(/\s*\n\s*/g, ' ')}`).join('\n');
}

// "4 photos and 1 video", "none yet" without media.
function mediaText({ photo, video }: ChatContext['media']): string {
  const count = (n: number, one: string) => (n === 0 ? null : `${n} ${one}${n === 1 ? '' : 's'}`);
  return [count(photo, 'photo'), count(video, 'video')].filter(Boolean).join(' and ') || 'none yet';
}

// The post's values: none without one (`context` null), so its lines and heading are left out.
function postValues(context: ChatContext | null): Record<string, string> {
  if (!context) return { media: '', tags: '', mentions: '', caption: '' };
  const caption = context.text.trim();
  return {
    media: mediaText(context.media),
    tags: context.tags.join(', '),
    mentions: context.mentions.join(', '),
    caption: caption ? JSON.stringify(caption) : '(empty)',
  };
}

/**
 * The writing briefing, `template` (instructions.writing) filled with the creator's persona, their
 * Favorites (the texts, newest first, as "- " lines like the rules, each on one line) and the chat's
 * post (`context`, null for none): `{caption}` is the caption as a JSON string, or (empty);
 * `{count}` the options to write. A line whose value is empty is left out, with its heading
 * (fillLines).
 */
export function writingBriefingText(
  template: string,
  { persona, favorites, context }: { persona: Persona; favorites: string[]; context: ChatContext | null },
): string {
  return fillLines(template, {
    ...personaValues(persona),
    favorites: favoritesText(favorites),
    ...postValues(context),
    count: String(WRITING_TWEET_COUNT),
  });
}

/**
 * A photo tags request: the photo tags briefing (`prompt`: the user's Photo tags instructions, or a
 * compare's prompt) filled with the creator's content themes (their persona's `contentTags`; the line
 * is left out without any, as for a compare) as the system message, then the photo.
 */
export function visionMessages({
  prompt,
  imageDataUrl,
  contentTags = [],
}: {
  prompt: string;
  imageDataUrl: string;
  contentTags?: string[];
}): ChatMessage[] {
  return [
    { role: 'system', content: fillLines(prompt, { themes: contentTags.join(', ') }) },
    { role: 'user', content: [{ type: 'image_url', image_url: { url: imageDataUrl } }] },
  ];
}

/**
 * A vision compare's request: the prompt box (visionMessages, without content themes) and a line on
 * the answer's format, then the photo; each of `earlierRounds` (the model's tags of this photo in
 * its last rounds, oldest first) follows as its answer, then asks for different ones.
 */
export function compareVisionMessages({
  prompt,
  imageDataUrl,
  earlierRounds = [],
}: {
  prompt: string;
  imageDataUrl: string;
  earlierRounds?: string[][];
}): ChatMessage[] {
  const [system, photo] = visionMessages({ prompt, imageDataUrl });
  return [
    { role: 'system', content: `${system!.content}\n\n${COMPARE_VISION_FORMAT}` },
    photo!,
    ...earlierRounds.flatMap((tags): ChatMessage[] => [
      { role: 'assistant', content: JSON.stringify({ tags }) },
      { role: 'user', content: COMPARE_TAG_DIFFERENT },
    ]),
  ];
}

// A JSON object of these properties, all required.
function objectSchema(properties: Record<string, unknown>) {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

// A JSON object holding one list of strings.
function stringListSchema(key: string) {
  return objectSchema({ [key]: { type: 'array', items: { type: 'string' } } });
}

/**
 * A reply that is one list of strings under `key`. Some models answer the bare list instead of the
 * object around it, or the object inside a list, even held to the schema: those read as the list
 * too (the objects' lists joined).
 */
function stringListSpec<K extends string>(key: K): JsonSchemaSpec<Record<K, string[]>> {
  const list = z.array(z.string());
  const object = z.object({ [key]: list } as Record<K, typeof list>);
  return {
    name: key,
    jsonSchema: stringListSchema(key),
    zod: z.union([
      object,
      list.transform((items) => ({ [key]: items }) as Record<K, string[]>),
      z
        .array(object)
        .min(1)
        .transform((objects) => ({ [key]: objects.flatMap((item) => item[key]) }) as Record<K, string[]>),
    ]),
  };
}

// A chat reply: what the assistant says and the options for the post, when asked for (tasks.ts checks
// them and keeps the first CHAT_LIMITS.posts; a maxItems here invited ten options).
export const chatReplyJsonSpec: JsonSchemaSpec<ChatReply> = {
  name: 'chat_reply',
  jsonSchema: objectSchema({
    reply: { type: 'string' },
    postOptions: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Options for the post being edited: finished post texts, one per item. Empty unless the creator asked for posts.',
    },
  }),
  zod: chatReplyFieldsSchema,
};

// A writing compare's answer: only the posts its prompt asks for, so a model has nowhere else to put
// them.
export const postsSchema = stringListSpec('posts');

export const tagsSchema = stringListSpec('tags');

// The judge's verdict on one chat turn.
export const judgeVerdictJsonSpec: JsonSchemaSpec<{ pass: boolean; reason: string }> = {
  name: 'judge_verdict',
  jsonSchema: objectSchema({ pass: { type: 'boolean' }, reason: { type: 'string' } }),
  zod: z.object({ pass: z.boolean(), reason: z.string() }),
};
