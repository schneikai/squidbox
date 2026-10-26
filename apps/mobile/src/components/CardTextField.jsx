import { StyleSheet } from 'react-native';

import Card from '@/components/Card';
import TextInput from '@/components/TextInput';
import Textarea from '@/components/Textarea';
import { SCREEN_PADDING } from '@/constants';

/**
 * A text field on a Card, inset like a list row's text: one line, or a Textarea with `multiline`
 * (`minHeight` sets its height). Other props go to the input.
 */
export default function CardTextField({ multiline = false, ...rest }) {
  const Input = multiline ? Textarea : TextInput;
  return (
    <Card>
      <Input style={styles.input} {...rest} />
    </Card>
  );
}

const styles = StyleSheet.create({
  input: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
});
