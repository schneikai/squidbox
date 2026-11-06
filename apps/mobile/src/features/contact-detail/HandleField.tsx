import { CONTACT_HANDLES, CONTACT_LIMITS } from '@squidbox/shared';

import DuplicateDot from './DuplicateDot';
import FillMark from './FillMark';
import LabelledInputRow from './LabelledInputRow';
import type { FillSource, HandleFormField } from './contactFields';
import openContactLinkAsync from './openContactLinkAsync';

import Button from '@/components/Button';
import IconSlotContext from '@/components/IconSlotContext';
import RowMark from '@/components/RowMark';
import type { TextInputProps } from '@/components/TextInput';

const OPEN_LABELS = {
  ...(Object.fromEntries(CONTACT_HANDLES.map(({ field, label }) => [field, `Open on ${label}`])) as Record<
    HandleFormField,
    string
  >),
  phoneNumber: 'Message on WhatsApp',
};
// The longest text each field takes (the synced schema's limits; a handle as typed or pasted).
const MAX_LENGTHS: Partial<Record<HandleFormField | 'name', number>> = {
  name: CONTACT_LIMITS.name,
  phoneNumber: CONTACT_LIMITS.phoneNumber,
};

export type HandleFieldProps = {
  field: HandleFormField | 'name';
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: TextInputProps['onBlur'];
  placeholder?: string;
  filledBy?: FillSource;
  isDuplicate?: boolean;
  isOpenable?: boolean;
};

/**
 * One of a contact's handles (or its phone number) as a row of a card: the label on the left, the
 * text on the right, and while it holds one a 44 pt button that opens it where it lives
 * (openContactLinkAsync). `field` is the contact field it edits (xHandle, …, phoneNumber, or the
 * name in the New contact sheet): a handle takes no capitals or corrections, the phone number the
 * phone pad. `filledBy` marks a value filled in for the user: by the assistant (a sparkle) or from a
 * link (the link icon); `isDuplicate` one another contact has too (an amber dot).
 */
export default function HandleField({
  field,
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  filledBy,
  isDuplicate = false,
  isOpenable = true,
}: HandleFieldProps) {
  const isPhone = field === 'phoneNumber';
  const isName = field === 'name';

  return (
    <LabelledInputRow
      label={label}
      endsWithButton
      value={value}
      onChangeText={onChangeText}
      onBlur={onBlur}
      placeholder={placeholder}
      maxLength={MAX_LENGTHS[field] ?? CONTACT_LIMITS.handle}
      autoCapitalize={isName ? 'words' : 'none'}
      keyboardType={isPhone ? 'phone-pad' : 'default'}
      textContentType={isPhone ? 'telephoneNumber' : isName ? 'name' : 'none'}
    >
      {(isDuplicate || !!filledBy) && (
        <RowMark>
          {isDuplicate && <DuplicateDot accessibilityLabel="Another contact has this too" />}
          {filledBy && <FillMark source={filledBy} />}
        </RowMark>
      )}
      {isOpenable && field !== 'name' && !!value.trim() && (
        // A full 44 pt slot, so its icon sits as far in from the card's edge as the rows' text does.
        <IconSlotContext.Provider value>
          <Button
            icon={isPhone ? 'message-circle' : 'external-link'}
            onPress={() => openContactLinkAsync(field, value)}
            accessibilityLabel={OPEN_LABELS[field]}
          />
        </IconSlotContext.Provider>
      )}
    </LabelledInputRow>
  );
}
