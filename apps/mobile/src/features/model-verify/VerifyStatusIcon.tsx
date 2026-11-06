import { ActivityIndicator } from 'react-native';

import Icon, { type IconName } from '@/components/Icon';
import { colors, sizes } from '@/styles/designTokens';

export type VerifyStatus = 'passed' | 'missed' | 'stopped' | 'waiting' | 'running';

const ICONS: Record<Exclude<VerifyStatus, 'running'>, { name: IconName; color: string }> = {
  passed: { name: 'check-circle', color: colors.status.success },
  missed: { name: 'close-circle', color: colors.status.danger },
  stopped: { name: 'alert', color: colors.status.danger },
  waiting: { name: 'clock', color: colors.text.tertiary },
};

type VerifyStatusIconProps = { status: VerifyStatus };

/** How a Verify, a conversation or a photo went: `status` passed | missed | stopped | waiting | running (a spinner). */
export default function VerifyStatusIcon({ status }: VerifyStatusIconProps) {
  if (status === 'running') return <ActivityIndicator color={colors.text.secondary} />;
  const { name, color } = ICONS[status];
  return <Icon name={name} size={sizes.icon} color={color} />;
}
