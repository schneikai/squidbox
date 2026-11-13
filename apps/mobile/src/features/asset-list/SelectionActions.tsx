import Button from '@/components/Button';
import type useAssetSelectionActions from '@/features/asset-list/useAssetSelectionActions';
import canShareFiles from '@/utils/files/canShareFiles';

export type SelectionActionsProps = {
  actions: ReturnType<typeof useAssetSelectionActions>;
  onDelete?: () => void;
  onClose: () => void;
};

// The buttons of select mode, for a floating pill: select all, share (where canShareFiles), Add to
// Album, post, delete (when `onDelete` is given) and close. `actions` comes from useAssetSelectionActions.
export default function SelectionActions({ actions, onDelete, onClose }: SelectionActionsProps) {
  const disabled = !actions.hasSelection;
  return (
    <>
      <Button
        icon="checkbox"
        onPress={actions.toggleSelectAll}
        isSelected={actions.allSelected}
        accessibilityLabel="Select all"
      />
      {canShareFiles && (
        <Button icon="share" onPress={actions.shareSelected} disabled={disabled} accessibilityLabel="Share" />
      )}
      <Button
        icon="library"
        onPress={actions.addSelectedToAlbum}
        disabled={disabled}
        accessibilityLabel="Add to Album"
      />
      <Button icon="edit" onPress={actions.postSelected} disabled={disabled} accessibilityLabel="Post" />
      {onDelete && (
        <Button icon="trash" onPress={onDelete} disabled={disabled} colorPalette="danger" accessibilityLabel="Delete" />
      )}
      <Button variant="primary" icon="close" onPress={onClose} accessibilityLabel="Done" />
    </>
  );
}
