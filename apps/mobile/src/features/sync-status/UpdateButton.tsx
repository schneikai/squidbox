import Button, { type ButtonProps } from '@/components/Button';
import useUpdateApp from '@/features/sync-status/useUpdateApp';

type UpdateButtonProps = Pick<ButtonProps, 'size' | 'isInverse' | 'colorPalette'>;

/** The update gate's Update action (useUpdateApp) as a Button, in the look its place asks for. */
export default function UpdateButton({ size, isInverse, colorPalette }: UpdateButtonProps) {
  const { update, updating } = useUpdateApp();
  return (
    <Button
      label="Update"
      size={size}
      isInverse={isInverse}
      colorPalette={colorPalette}
      loading={updating}
      onPress={update}
    />
  );
}
