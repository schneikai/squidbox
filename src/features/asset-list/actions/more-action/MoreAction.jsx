import PopupMenu from '@/components/popup-menu-options/PopupMenu';
import ToggleThumbnailStyleOption from '@/components/popup-menu-options/ToggleThumbnailStyleOption';

export default function MoreAction() {
  return (
    <PopupMenu icon="ellipsis-vertical">
      <ToggleThumbnailStyleOption />
    </PopupMenu>
  );
}
