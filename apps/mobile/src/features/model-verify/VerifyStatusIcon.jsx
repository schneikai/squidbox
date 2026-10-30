import { ActivityIndicator } from 'react-native';

import Icon from '@/components/Icon';
import { colors, sizes } from '@/styles/designTokens';

const ICONS = {
  passed: { name: 'check-circle', color: colors.status.success },
  missed: { name: 'close-circle', color: colors.status.danger },
  stopped: { name: 'alert', color: colors.status.danger },
  waiting: { name: 'clock', color: colors.text.tertiary },
};

/** How a Verify, a conversation or a photo went: `status` passed | missed | stopped | waiting | running (a spinner). */
export default function VerifyStatusIcon({ status }) {
  if (status === 'running') return <ActivityIndicator color={colors.text.secondary} />;
  const { name, color } = ICONS[status];
  return <Icon name={name} size={sizes.icon} color={color} />;
}
