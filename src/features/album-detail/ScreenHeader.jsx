import { View, Text } from 'react-native';

import ScreenHeaderWithBackButton from '@/components/screen-header/ScreenHeaderWithBackButton';
import AlbumLastPostedAt from '@/features/album-list/AlbumLastPostedAt';
import pluralizeText from '@/utils/pluralizeText';

export default function AlbumScreenHeader({ album, numberOfAssets, onPressBack, children, insets = { top: 0 } }) {
  return (
    <ScreenHeaderWithBackButton
      label={album.name}
      onPressBack={onPressBack}
      insets={insets}
      SubLabelComponent={
        <View style={{ marginBottom: 5 }}>
          <Text>{pluralizeText('1 Asset', '%{count} Assets', numberOfAssets)}</Text>
          <AlbumLastPostedAt album={album} />
        </View>
      }
    >
      {children}
    </ScreenHeaderWithBackButton>
  );
}
