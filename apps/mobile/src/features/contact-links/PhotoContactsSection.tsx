import { router } from 'expo-router';

import ContactChipsSection from './ContactChipsSection';
import TargetContactChip from './TargetContactChip';

import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import useContactRows from '@/features/contact-list/useContactRows';
import useSheetRoute from '@/hooks/useSheetRoute';
import unguarded, { type GuardPress } from '@/lib/unguarded';

type PhotoContactsSectionProps = {
  assetId: string;
  guardPress?: GuardPress;
  isLive?: boolean;
  isFlush?: boolean;
};

/**
 * The Contacts section of a photo (`assetId`): a chip per contact on it, opening the contact (its ×
 * takes it off, TargetContactChip), and Add, which opens the Add contacts sheet. Inside a sheet (a
 * photo opened in New post or Compare) it only shows who is on it (ContactChipsSection), never a
 * screen that edits as you type inside a draft. `guardPress` may wrap the presses
 * (useDetailsPanelDrag's); `isLive: false` reads them once.
 */
export default function PhotoContactsSection(props: PhotoContactsSectionProps) {
  const isInSheet = !!useSheetRoute();

  if (isInSheet) {
    return <ContactChipsSection scope={{ photoIds: [props.assetId] }} isLive={props.isLive} isFlush={props.isFlush} />;
  }
  return <EditablePhotoContacts {...props} />;
}

// A photo's contacts outside a sheet: chips that open or take off a contact, and Add.
function EditablePhotoContacts({ assetId, guardPress = unguarded, isLive, isFlush }: PhotoContactsSectionProps) {
  const contacts = useContactRows({ scope: { photoIds: [assetId] } }, { isLive });

  return (
    <>
      <ScreenSectionHeader title="Contacts" isFlush={isFlush} />
      <ChipRow>
        {contacts?.map((contact) => (
          <TargetContactChip
            key={contact.id}
            contact={contact}
            assetId={assetId}
            onOpen={guardPress(() => router.navigate(`/contact/${contact.id}`))}
          />
        ))}
        <Chip
          variant="add"
          label="Add"
          accessibilityLabel="Add contacts"
          onPress={guardPress(() => router.navigate({ pathname: '/add-contacts', params: { assetId } }))}
        />
      </ChipRow>
    </>
  );
}
