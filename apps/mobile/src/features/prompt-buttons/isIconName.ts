import { ICON_NAMES } from '@/components/Icon';
import isOneOf from '@/lib/isOneOf';

// Whether a stored icon (any name, as the shared schema allows) is one Icon can draw.
const isIconName = isOneOf(ICON_NAMES);

export default isIconName;
