import { z } from 'zod';
import { type BaseRecord, baseRecordSchema, defineCollection, textSchema } from './define';
import { PROMPT_BUTTON_LIMITS } from './promptButton';

// The ideas the post editor writes without being asked: Post ideas for a new post once it has
// media, Repost ideas when a repost's editor opens.
export const IDEAS_KINDS = ['post', 'repost'] as const;
export type IdeasKind = (typeof IDEAS_KINDS)[number];

/** How long an ideas prompt may be: as long as a prompt button's. */
export const IDEA_SETTING_LIMITS = { prompt: PROMPT_BUTTON_LIMITS.prompt } as const;

// `idea_settings` — how the user set up those ideas (Settings → Assistant → Post ideas, Repost
// ideas): per kind whether they start on their own (`*On`) and the prompt they send (`*Prompt`; null
// is the built-in text, DEFAULT_IDEA_PROMPTS). One record per user, whose id is the user's id, like
// `personas`, so every device writes the same record and the per-field merge converges.
const ideaPromptSchema = textSchema.min(1).max(IDEA_SETTING_LIMITS.prompt).nullable();
export const ideaSettingCollection = defineCollection({
  name: 'idea_settings',
  schema: baseRecordSchema.extend({
    postIdeasOn: z.boolean(),
    repostIdeasOn: z.boolean(),
    postIdeasPrompt: ideaPromptSchema,
    repostIdeasPrompt: ideaPromptSchema,
  }),
});

export type IdeaSettingRecord = z.infer<typeof ideaSettingCollection.schema>;

/** The record's fields of each kind: its switch and its prompt. */
export const IDEA_SETTING_FIELDS = {
  post: { isOn: 'postIdeasOn', prompt: 'postIdeasPrompt' },
  repost: { isOn: 'repostIdeasOn', prompt: 'repostIdeasPrompt' },
} as const satisfies Record<IdeasKind, { isOn: keyof IdeaSettingRecord; prompt: keyof IdeaSettingRecord }>;

/** The settings themselves: the record without its base columns. */
export type IdeaSettingFields = Omit<IdeaSettingRecord, keyof BaseRecord>;

/** The settings before the user changed any: every kind on, with its built-in prompt (null). */
export const DEFAULT_IDEA_SETTINGS: Readonly<IdeaSettingFields> = Object.freeze({
  postIdeasOn: true,
  repostIdeasOn: true,
  postIdeasPrompt: null,
  repostIdeasPrompt: null,
});

/** The prompt of each kind while the user hasn't written their own. */
export const DEFAULT_IDEA_PROMPTS: Readonly<Record<IdeasKind, string>> = Object.freeze({
  post: 'Write three ideas for this post based on the photos. Make it a mix: one short caption, one that asks my followers a question, and one that tells a tiny story about the moment. Keep each under 200 characters, no hashtags, at most one emoji.',
  repost:
    "Write 3 fresh posts that repost this for people who missed it. Same content, a new angle each time. Don't repeat the original wording.",
});

/** A kind's settings as the app uses them. */
export type IdeasSetting = { isOn: boolean; prompt: string };

/**
 * Each kind's settings from the user's record (null before they changed any): on, and the built-in
 * prompt, until they set their own.
 */
export function resolveIdeaSettings(
  record: Partial<IdeaSettingFields> | null | undefined,
): Record<IdeasKind, IdeasSetting> {
  return Object.fromEntries(
    IDEAS_KINDS.map((kind) => {
      const fields = IDEA_SETTING_FIELDS[kind];
      return [
        kind,
        {
          isOn: record?.[fields.isOn] ?? DEFAULT_IDEA_SETTINGS[fields.isOn],
          prompt: record?.[fields.prompt] ?? DEFAULT_IDEA_PROMPTS[kind],
        },
      ];
    }),
  ) as Record<IdeasKind, IdeasSetting>;
}
