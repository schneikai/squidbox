import GradientButton from '@/components/GradientButton';
import Icon from '@/components/Icon';
import IconButton from '@/components/IconButton';
import { colors } from '@/styles/designTokens';

// The buttons of select mode, for a floating pill: select all, download, add to album, post, delete
// (when `onDelete` is given) and close. `actions` comes from useAssetSelectionActions.
export default function SelectionActions({ actions, onDelete, onClose }) {
  const disabled = !actions.hasSelection;
  return (
    <>
      <IconButton
        icon="checkbox"
        onPress={actions.toggleSelectAll}
        isActive={actions.allSelected}
        accessibilityLabel="Select all"
      />
      <IconButton
        icon="download"
        onPress={actions.downloadSelected}
        disabled={disabled}
        accessibilityLabel="Download"
      />
      <IconButton
        icon="library"
        onPress={actions.addSelectedToAlbum}
        disabled={disabled}
        accessibilityLabel="Add to album"
      />
      <IconButton icon="share" onPress={actions.postSelected} disabled={disabled} accessibilityLabel="Post" />
      {onDelete && (
        <IconButton icon="trash" onPress={onDelete} disabled={disabled} danger accessibilityLabel="Delete" />
      )}
      <GradientButton onPress={onClose} accessibilityLabel="Done">
        <Icon name="close" color={colors.textInverse} />
      </GradientButton>
    </>
  );
}
