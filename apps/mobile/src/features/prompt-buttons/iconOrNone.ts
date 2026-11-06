import { ICON_NAMES, type IconName } from '@/components/Icon';
import isOneOf from '@/lib/isOneOf';

const isIconName = isOneOf(ICON_NAMES);

// A stored icon name (any string, as a synced record allows) as the Icon name it is, or undefined
// for one Icon doesn't know (which it would draw as nothing).
export default function iconOrNone(name: string | null | undefined): IconName | undefined {
  return isIconName(name) ? name : undefined;
}
