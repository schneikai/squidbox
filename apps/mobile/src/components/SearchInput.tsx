import TextInput, { type TextInputProps } from '@/components/TextInput';

export type SearchInputProps = TextInputProps;

/**
 * A TextInput for search terms, no autocorrect or autocapitalization: the floating search bar's field
 * (SearchOptionsBar). Its props, `ref` too, are React Native's TextInput's.
 */
export default function SearchInput(props: SearchInputProps) {
  return <TextInput placeholder="Search" autoCorrect={false} autoCapitalize="none" {...props} />;
}
