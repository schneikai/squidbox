import TextInput from './TextInput';

// A TextInput for search terms: no autocorrect or autocapitalization.
export default function SearchTextInput(props) {
  return <TextInput placeholder="Search" autoCorrect={false} autoCapitalize="none" {...props} />;
}
