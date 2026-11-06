import { ICON_NAMES, type IconName } from './Icon';

const NAMES: ReadonlySet<string> = new Set(ICON_NAMES);

function isIconName(name: string): name is IconName {
  return NAMES.has(name);
}

// A stored icon name (any string, as a synced record allows) as the Icon name it is, or undefined
// for one Icon doesn't know (which it would draw as nothing).
export default function iconOrNone(name: string | null | undefined): IconName | undefined {
  return name != null && isIconName(name) ? name : undefined;
}
