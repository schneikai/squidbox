import Button from '@/components/Button';
import ModalHeader from '@/components/ModalHeader';
import useSheetRoute from '@/hooks/useSheetRoute';

/**
 * An edit sheet's header (EditSheet's, and a sheet whose body is its own list): × on the leading side
 * to cancel (Back when pushed inside another sheet), the optional `title` and `subtitle`, and
 * `confirmLabel` (Add for a new item, Save for an edit) on the trailing side, off unless `canConfirm`,
 * with a spinner while `isSaving`, when × is off too. Takes the props hooks/useEditSheet gives.
 */
export type EditSheetHeaderProps = {
  title?: string;
  subtitle?: string;
  confirmLabel: string;
  canConfirm: boolean;
  isSaving?: boolean;
  onCancel: () => void;
  onConfirm?: () => void;
};

export default function EditSheetHeader({
  title,
  subtitle,
  confirmLabel,
  canConfirm,
  isSaving = false,
  onCancel,
  onConfirm,
}: EditSheetHeaderProps) {
  const isSheetRoute = useSheetRoute()?.isFirstScreen ?? true;

  return (
    <ModalHeader
      leading={
        <Button
          icon={isSheetRoute ? 'close' : 'chevron-left'}
          accessibilityLabel={isSheetRoute ? 'Close' : 'Back'}
          onPress={onCancel}
          disabled={isSaving}
        />
      }
      title={title}
      subtitle={subtitle}
      trailing={
        <Button
          variant="primary"
          label={confirmLabel}
          onPress={onConfirm}
          disabled={!canConfirm || isSaving}
          loading={isSaving}
        />
      }
    />
  );
}
