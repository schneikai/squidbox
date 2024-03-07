import TextMenuOption from '@/components/popup-menu-options/TextMenuOption';
import useAppSettings from '@/features/app-settings/useAppSettings';

export default function ToggleThumbnailStyleOption() {
  const { thumbnailStyle, setThumbnailStyle } = useAppSettings();

  if (thumbnailStyle === 'contain') {
    return <TextMenuOption label="Square image grid" onPress={() => setThumbnailStyle('cover')} />;
  } else {
    return <TextMenuOption label="Full image grid" onPress={() => setThumbnailStyle('contain')} />;
  }
}
