import type { NativeStackNavigationProp } from 'expo-router';
import type { NavigationProp, ParamListBase } from 'expo-router/react-navigation';

// The stack of sheets the post editor opens in.
type Sheets = Pick<NativeStackNavigationProp<ParamListBase>, 'getState' | 'pop'>;

// Closes the editor sheet and, when it was opened over the New post sheet, that sheet too (useEditSheet
// leaves with a returned function). Otherwise undefined: the editor goes back to where it was opened.
// `editor` is the editor screen's navigation; the sheets are its parent. It runs after the post was
// added, so it never throws: without sheets around the editor it, too, just goes back.
export default function leaveWithNewPostSheet(
  editor: Pick<NavigationProp<ParamListBase>, 'getParent'>,
): (() => void) | undefined {
  const sheets = editor.getParent<Sheets | undefined>();
  if (!sheets) return undefined;
  const { routes, index } = sheets.getState();
  if (routes[index - 1]?.name !== '(new-post)') return undefined;
  return () => sheets.pop(2);
}
