import { View } from 'react-native';

import EmptyState from '@/components/EmptyState';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
import useScreenPadding from '@/hooks/useScreenPadding';

export default function ContactsScreen() {
  const { paddingTop } = useScreenPadding('main');

  return (
    <View style={{ flex: 1, paddingTop }}>
      <FloatingHeader title="Contacts" />
      <EmptyState icon="id-card" title="No contacts yet" />
    </View>
  );
}
