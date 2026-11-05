import { View } from 'react-native';

import HandleField from './HandleField';
import { HANDLE_FIELDS } from './contactFields';

import Card from '@/components/Card';
import Divider from '@/components/Divider';

/**
 * A contact form's card of handles and phone number (HANDLE_FIELDS), one HandleField row each, from
 * the `draft` and `onChange(field, text)`. `children` go first (the New contact sheet's name);
 * `fieldProps(field)` adds a row's marks (isFilled, isDuplicate); `isOpenable` the open buttons.
 */
export default function HandleFieldsCard({ draft, onChange, onBlur, fieldProps, isOpenable, children, style }) {
  return (
    <Card style={style}>
      {children}
      {HANDLE_FIELDS.map(({ field, label, placeholder }, index) => (
        <View key={field}>
          {(index > 0 || !!children) && <Divider />}
          <HandleField
            field={field}
            label={label}
            value={draft[field]}
            onChangeText={(text) => onChange(field, text)}
            onBlur={onBlur}
            placeholder={placeholder}
            isOpenable={isOpenable}
            {...fieldProps?.(field)}
          />
        </View>
      ))}
    </Card>
  );
}
