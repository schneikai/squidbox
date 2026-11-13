import { CONTACT_HANDLES, CONTACT_LIMITS } from '@squidbox/shared';

import DuplicateDot from './DuplicateDot';
import FillMark from './FillMark';
import LabelledInputRow from './LabelledInputRow';
import type { HandleFormField } from './contactFields';
import handleLink from './handleLink';
import openContactLinkAsync from './openContactLinkAsync';

import Button from '@/components/Button';
import IconSlotContext from '@/components/IconSlotContext';
import type { TextInputProps } from '@/components/TextInput';
import RowMark from '@/features/contact-detail/RowMark';

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
  isFilled?: boolean;
  isDuplicate?: boolean;
  isOpenable?: boolean;
};

/**
 * One of a contact's handles (or its phone number) as a row of a card: the label on the left, the
 * text on the right, and while it holds one a 44 pt button that opens it where it lives
 * (openContactLinkAsync). `field` is the contact field it edits (xHandle, …, phoneNumber, or the
 * name in the New contact sheet): a handle takes no automatic capitals or corrections, the phone
 * number the phone pad. `isFilled` marks a value filled in for the user with the sparkle (FillMark);
 * `isDuplicate` one another contact has too (an amber dot).
 */
export default function HandleField({
  field,
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  isFilled = false,
  isDuplicate = false,
  isOpenable = true,
}: HandleFieldProps) {
  const isPhone = field === 'phoneNumber';
  const isName = field === 'name';
  // Something to open: a phone number, or a handle with a link (only `@`s have none).
  const hasLink = isPhone ? !!value.trim() : !isName && handleLink(field, value) !== null;

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
      {(isDuplicate || isFilled) && (
        <RowMark>
          {isDuplicate && <DuplicateDot accessibilityLabel="Another contact has this too" />}
          {isFilled && <FillMark />}
        </RowMark>
      )}
      {isOpenable && !isName && hasLink && (
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
