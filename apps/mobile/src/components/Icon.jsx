/**
 * Icon — maps semantic icon names to Lucide React Native components.
 *
 * Centralises the icon set so swapping icons only requires changing this file.
 *
 * Props:
 *   name   – string key (see ICON_MAP)
 *   size   – defaults to sizes.icon
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
  AtSign,
  Award,
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleArrowUp,
  CircleCheck,
  CircleOff,
  CirclePlus,
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
  Feather,
  FileText,
  Flame,
  Folder,
  Grid3x3,
  Hash,
  Heading,
  Heart,
  Image,
  Images,
  Info,
  Languages,
  Laugh,
  LayoutGrid,
  LayoutTemplate,
  Library,
  Link,
  List,
  ListChecks,
  ListFilter,
  Lock,
  MapPin,
  Maximize2,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  MountainSnow,
  Pause,
  PenLine,
  Play,
  Plus,
  Printer,
  Quote,
  Repeat2,
  Scissors,
  Search,
  Share,
  Share2,
  SlidersHorizontal,
  Smartphone,
  Smile,
  Sparkle,
  SpellCheck,
  SquareCheck,
  Star,
  Tag,
  ThumbsUp,
  Trash2,
  Undo2,
  User,
  Video,
  Volume2,
  VolumeX,
  Vote,
  X,
} from '@/lib/lucide';
import { sizes } from '@/styles/designTokens';

const ICON_MAP = {
  add: Plus,
  'add-circle': CirclePlus,
  alert: CircleAlert,
  apps: LayoutGrid,
  archive: Archive,
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  'arrow-up-circle': CircleArrowUp,
  award: Award,
  calendar: Calendar,
  check: Check,
  'check-circle': CircleCheck,
  checkbox: SquareCheck,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'circle-off': CircleOff,
  clock: Clock,
  close: X,
  'close-circle': CircleX,
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
  feather: Feather,
  filter: ListFilter,
  flame: Flame,
  folder: Folder,
  formal: Briefcase,
  grid: Grid3x3,
  hash: Hash,
  heading: Heading,
  heart: Heart,
  image: Image,
  images: Images,
  info: Info,
  laugh: Laugh,
  library: Library,
  link: Link,
  list: List,
  'list-checks': ListChecks,
  lock: Lock,
  'map-pin': MapPin,
  megaphone: Megaphone,
  mention: AtSign,
  menu: Ellipsis,
  'message-circle': MessageCircle,
  mobile: Smartphone,
  mountain: MountainSnow,
  options: SlidersHorizontal,
  pause: Pause,
  play: Play,
  poll: Vote,
  printer: Printer,
  'prompt-buttons': LayoutTemplate,
  quote: Quote,
  repeat: Repeat2,
  scissors: Scissors,
  search: Search,
  share: Share,
  'share-alt': Share2,
  smile: Smile,
  sort: ArrowUpDown,
  sparkle: Sparkle,
  'spell-check': SpellCheck,
  star: Star,
  tag: Tag,
  thread: MessagesSquare,
  'thumbs-up': ThumbsUp,
  translate: Languages,
  trash: Trash2,
  undo: Undo2,
  user: User,
  video: Video,
  'volume-off': VolumeX,
  'volume-on': Volume2,
};

export default function Icon({ name, size = sizes.icon, color, filled, style }) {
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
