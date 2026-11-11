import type { IdeasKind, IdeasSetting } from '@squidbox/shared';

import type { IdeasRun } from './ideasRun';
import ideasText from './ideasText';

import type { UserTurn } from '@/features/post-chat/chatSessions';

const MORE = 'More';

/**
 * The tray's turns for the post `target`: `ideas(kind, setting)`, its own ideas prompt (the user's
 * Post ideas or Repost ideas, under that name), which starts a run; and `more(run)`, More after the
 * run's ideas: the run's prompt again, which the server puts its More instruction before.
 */
const ideasTurns = {
  ideas: (kind: IdeasKind, setting: IdeasSetting, target: string): UserTurn => ({
    label: ideasText[kind].name,
    content: setting.prompt,
    kind: 'ideas',
    target,
  }),
  more: (run: Pick<IdeasRun, 'prompt'>, target: string): UserTurn => ({
    label: MORE,
    content: run.prompt,
    kind: 'more',
    target,
  }),
};

export default ideasTurns;
