import { router, useLocalSearchParams, useNavigation } from 'expo-router';

import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import AssetGrid from '@/features/asset-list/AssetGrid';
import assetHref from '@/features/asset-list/assetHref';
import assetQuery from '@/features/asset-list/assetQuery';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import useScreenPadding from '@/hooks/useScreenPadding';
import { schema } from '@/sync/db/client';
import { useLiveRecord } from '@/sync/useLiveRecord';
import { usePagedQuery } from '@/sync/usePagedQuery';

// Every photo a contact is on, newest first, as a grid; a photo opens in that scope.
export default function ContactPhotosScreen() {
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const navigation = useNavigation();
  const contact = useLiveRecord(schema.contacts, contactId);
  useCloseWhenGone(contact, 'This contact was deleted');
  const { paddingTop, paddingBottom } = useScreenPadding('detail');
  const query = assetQuery({ scope: { contactId } });
  const { rows, readAt, loadMore } = usePagedQuery<schema.AssetRow>(query, 150, { withReadAt: true });

  if (!contact) return null;

  return (
    <Page>
      <FloatingDetailHeader title="Photos" subtitle={contact.name} onBack={() => navigation.goBack()} />
      <AssetGrid
        rows={rows}
        rowsReadAt={readAt}
        loadMore={loadMore}
        onPressAsset={(asset) => router.navigate(assetHref(asset.id, query.descriptor))}
        paddingTop={paddingTop}
        paddingBottom={paddingBottom}
      />
    </Page>
  );
}
