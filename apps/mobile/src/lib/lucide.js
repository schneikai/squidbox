/**
 * Lucide icon shim — imports from individual CJS files instead of the barrel.
 *
 * The barrel (lucide-react-native) re-exports multiple `default` aliases from
 * the same source in one statement, which Babel/Metro cannot transform — all
 * exports come out undefined. Per-file CJS uses `module.exports = Component`,
 * which always works.
 *
 * Requires metro.config.js: config.resolver.unstable_enablePackageExports = false
 * so Metro can reach these subpaths (not listed in the package exports map).
 *
 * To add an icon: export { default as IconName } from 'lucide-react-native/dist/cjs/icons/icon-name';
 */

export { default as Archive } from 'lucide-react-native/dist/cjs/icons/archive';
export { default as Copy } from 'lucide-react-native/dist/cjs/icons/copy';
export { default as ArrowDown } from 'lucide-react-native/dist/cjs/icons/arrow-down';
export { default as ArrowUp } from 'lucide-react-native/dist/cjs/icons/arrow-up';
export { default as ArrowUpDown } from 'lucide-react-native/dist/cjs/icons/arrow-up-down';
export { default as Calendar } from 'lucide-react-native/dist/cjs/icons/calendar';
export { default as Check } from 'lucide-react-native/dist/cjs/icons/check';
export { default as ChevronDown } from 'lucide-react-native/dist/cjs/icons/chevron-down';
export { default as ChevronLeft } from 'lucide-react-native/dist/cjs/icons/chevron-left';
export { default as ChevronRight } from 'lucide-react-native/dist/cjs/icons/chevron-right';
export { default as CircleAlert } from 'lucide-react-native/dist/cjs/icons/circle-alert';
export { default as CircleArrowUp } from 'lucide-react-native/dist/cjs/icons/circle-arrow-up';
export { default as CircleCheck } from 'lucide-react-native/dist/cjs/icons/circle-check';
export { default as CircleX } from 'lucide-react-native/dist/cjs/icons/circle-x';
export { default as Clock } from 'lucide-react-native/dist/cjs/icons/clock';
export { default as CloudCheck } from 'lucide-react-native/dist/cjs/icons/cloud-check';
export { default as CloudDownload } from 'lucide-react-native/dist/cjs/icons/cloud-download';
export { default as CloudOff } from 'lucide-react-native/dist/cjs/icons/cloud-off';
export { default as Cpu } from 'lucide-react-native/dist/cjs/icons/cpu';
export { default as Download } from 'lucide-react-native/dist/cjs/icons/download';
export { default as Ellipsis } from 'lucide-react-native/dist/cjs/icons/ellipsis';
export { default as Eye } from 'lucide-react-native/dist/cjs/icons/eye';
export { default as EyeOff } from 'lucide-react-native/dist/cjs/icons/eye-off';
export { default as FileText } from 'lucide-react-native/dist/cjs/icons/file-text';
export { default as Folder } from 'lucide-react-native/dist/cjs/icons/folder';
export { default as Grid3x3 } from 'lucide-react-native/dist/cjs/icons/grid-3x3';
export { default as Heart } from 'lucide-react-native/dist/cjs/icons/heart';
export { default as Image } from 'lucide-react-native/dist/cjs/icons/image';
export { default as Images } from 'lucide-react-native/dist/cjs/icons/images';
export { default as LayoutGrid } from 'lucide-react-native/dist/cjs/icons/layout-grid';
export { default as Library } from 'lucide-react-native/dist/cjs/icons/library';
export { default as Link } from 'lucide-react-native/dist/cjs/icons/link';
export { default as List } from 'lucide-react-native/dist/cjs/icons/list';
export { default as ListFilter } from 'lucide-react-native/dist/cjs/icons/list-filter';
export { default as Maximize2 } from 'lucide-react-native/dist/cjs/icons/maximize-2';
export { default as Pencil } from 'lucide-react-native/dist/cjs/icons/pencil';
export { default as PenLine } from 'lucide-react-native/dist/cjs/icons/pen-line';
export { default as Plus } from 'lucide-react-native/dist/cjs/icons/plus';
export { default as Repeat2 } from 'lucide-react-native/dist/cjs/icons/repeat-2';
export { default as Search } from 'lucide-react-native/dist/cjs/icons/search';
export { default as Share } from 'lucide-react-native/dist/cjs/icons/share';
export { default as Share2 } from 'lucide-react-native/dist/cjs/icons/share-2';
export { default as SlidersHorizontal } from 'lucide-react-native/dist/cjs/icons/sliders-horizontal';
export { default as Smartphone } from 'lucide-react-native/dist/cjs/icons/smartphone';
export { default as Sparkles } from 'lucide-react-native/dist/cjs/icons/sparkles';
export { default as SquareCheck } from 'lucide-react-native/dist/cjs/icons/square-check';
export { default as Star } from 'lucide-react-native/dist/cjs/icons/star';
export { default as Trash2 } from 'lucide-react-native/dist/cjs/icons/trash-2';
export { default as Undo2 } from 'lucide-react-native/dist/cjs/icons/undo-2';
export { default as User } from 'lucide-react-native/dist/cjs/icons/user';
export { default as Video } from 'lucide-react-native/dist/cjs/icons/video';
export { default as Wand } from 'lucide-react-native/dist/cjs/icons/wand';
export { default as X } from 'lucide-react-native/dist/cjs/icons/x';
