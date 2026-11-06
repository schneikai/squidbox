import type { NativeStackNavigationProp } from 'expo-router';
import type { ParamListBase } from 'expo-router/react-navigation';

type Sheets = Pick<NativeStackNavigationProp<ParamListBase>, 'getState' | 'pop'>;

// Closes the editor sheet and, when it was opened over the New post sheet, that sheet too (useEditSheet
// leaves with a returned function). Otherwise undefined: the editor goes back to where it was opened.
export default function leaveWithNewPostSheet(sheets: Sheets): (() => void) | undefined {
  const { routes, index } = sheets.getState();
  if (routes[index - 1]?.name !== '(new-post)') return undefined;
  return () => sheets.pop(2);
}
