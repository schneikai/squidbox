import { useState } from 'react';
import { StyleSheet } from 'react-native';

import BottomSheet from '@/components/BottomSheet';
import Button from '@/components/Button';
import IntroText from '@/components/IntroText';

/**
 * What the model was told for a reply (`systemMessage`, the filled briefing the server answers an
 * ai_admin with): a link under the reply that opens it in a sheet, to read or copy.
 */
export default function SystemMessageButton({ systemMessage }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button label="What the model was told" size="small" onPress={() => setIsOpen(true)} style={styles.link} />
      <BottomSheet isVisible={isOpen} onClose={() => setIsOpen(false)} title="What the model was told">
        <IntroText selectable>{systemMessage}</IntroText>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  link: {
    alignSelf: 'flex-start',
  },
});
