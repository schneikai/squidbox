/**
 * Icon — maps semantic icon names to Lucide React Native components.
 *
 * Centralises the icon set so swapping icons only requires changing this file.
 *
 * Props:
 *   name   – string key (see ICON_MAP)
 *   size   – defaults to spacing.iconSize
 *   color  – icon stroke color
 *   filled – when true, applies fill={color} (meaningful for heart/star)
 *   style  – layout-only styles (e.g. margin)
 *
 * Icon set setup (lucide-react-native workaround)
 * ------------------------------------------------
 * Icons are imported from src/lib/lucide.js instead of lucide-react-native directly.
 * The package's ESM barrel re-exports the same `default` under multiple names in one
 * statement (`export { default as X, default as Y } from './icons/x'`), which
 * Babel/Metro cannot transform — all exports come out undefined at runtime.
 * The shim imports each icon from its individual CJS file, which works correctly.
 *
 * metro.config.js sets `config.resolver.unstable_enablePackageExports = false` so
 * Metro resolves packages via their react-native/main fields instead of the exports
 * map — this is required for the CJS subpaths used in the shim to be reachable.
 */

import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleArrowUp,
  CircleCheck,
  CircleX,
  Clock,
  CloudCheck,
  CloudDownload,
  CloudOff,
  Copy,
  Cpu,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  FileText,
  Folder,
  Grid3x3,
  Heart,
  Image,
  Images,
  LayoutGrid,
  Library,
  Link,
  List,
  ListFilter,
  Maximize2,
  Pencil,
  PenLine,
  Plus,
  Repeat2,
  Search,
  Share,
  Share2,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  SquareCheck,
  Star,
  Trash2,
  Undo2,
  User,
  Video,
  Wand,
  X,
} from '@/lib/lucide';
import { spacing } from '@/styles/designTokens';

const ICON_MAP = {
  add: Plus,
  alert: CircleAlert,
  apps: LayoutGrid,
  archive: Archive,
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  'arrow-up-circle': CircleArrowUp,
  calendar: Calendar,
  check: Check,
  'check-circle': CircleCheck,
  checkbox: SquareCheck,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  close: X,
  'close-circle': CircleX,
  clock: Clock,
  'cloud-check': CloudCheck,
  'cloud-download': CloudDownload,
  'cloud-offline': CloudOff,
  copy: Copy,
  cpu: Cpu,
  document: FileText,
  download: Download,
  edit: PenLine,
  expand: Maximize2,
  eye: Eye,
  'eye-off': EyeOff,
  filter: ListFilter,
  folder: Folder,
  grid: Grid3x3,
  heart: Heart,
  image: Image,
  images: Images,
  library: Library,
  link: Link,
  list: List,
  menu: Ellipsis,
  mobile: Smartphone,
  options: SlidersHorizontal,
  pencil: Pencil,
  repeat: Repeat2,
  search: Search,
  share: Share,
  'share-alt': Share2,
  sort: ArrowUpDown,
  sparkles: Sparkles,
  star: Star,
  trash: Trash2,
  undo: Undo2,
  user: User,
  video: Video,
  wand: Wand,
};

export default function Icon({ name, size = spacing.iconSize, color, filled, style }) {
  const IconComponent = ICON_MAP[name];

  if (!IconComponent) {
    if (__DEV__) console.warn(`Icon: no mapping for icon name "${name}"`);
    return null;
  }

  // Omit fill when unset — fill={undefined} overrides Lucide's fill="none" default, rendering icons black.
  return (
    <IconComponent size={size} color={color} {...(filled && color !== undefined && { fill: color })} style={style} />
  );
}
