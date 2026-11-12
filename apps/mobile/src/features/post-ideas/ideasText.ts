import type { IdeasKind } from '@squidbox/shared';

type IdeasText = { name: string; switchLabel: string };

// What each kind of ideas is called (the tray's lead chip, the chat's turn, Settings → Assistant)
// and what its switch says.
const ideasText: Record<IdeasKind, IdeasText> = {
  post: { name: 'Post ideas', switchLabel: 'Show ideas when I add photos' },
  repost: { name: 'Repost ideas', switchLabel: 'Show ideas when I open a repost' },
};

export default ideasText;
