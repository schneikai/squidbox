import MenuOption from '@/components/popup-menu-options/MenuOption';
import useAppSettings from '@/features/app-settings/useAppSettings';

export default function ToggleThumbnailStyleOption() {
  const { thumbnailStyle, setThumbnailStyle } = useAppSettings();

  if (thumbnailStyle === 'contain') {
    return (
      <MenuOption
        label="Square image grid"
        icon="grid-outline"
        onPress={() => setThumbnailStyle('cover')}
      />
    );
  }
  return (
    <MenuOption
      label="Full image grid"
      icon="expand-outline"
      onPress={() => setThumbnailStyle('contain')}
    />
  );
}
