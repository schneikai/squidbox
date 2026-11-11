import { StyleSheet } from 'react-native';

import Button from '@/components/Button';
import Card, { type CardProps } from '@/components/Card';
import Text from '@/components/Text';
import { layout } from '@/styles/designTokens';

type ReplyErrorProps = { error: string | null; onRetry: (() => void) | null; style?: CardProps['style'] };

/**
 * A reply that failed: what went wrong, on one line with Retry (`onRetry`, for the chat's last reply
 * only). style is for layout only.
 */
export default function ReplyError({ error, onRetry, style }: ReplyErrorProps) {
  return (
    <Card padded style={[styles.status, style]}>
      <Text variant="status" style={styles.text}>
        {error}
      </Text>
      {onRetry && <Button label="Retry" size="small" onPress={onRetry} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    // One line: a compact row's height.
    paddingVertical: layout.rowPaddingYCompact,
  },
  text: {
    flex: 1,
  },
});
