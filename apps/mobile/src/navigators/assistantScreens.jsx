import FavoriteScreen from '@/features/favorites/FavoriteScreen';
import FavoritesScreen from '@/features/favorites/FavoritesScreen';
import PromptButtonScreen from '@/features/prompt-buttons/PromptButtonScreen';
import PromptButtonsScreen from '@/features/prompt-buttons/PromptButtonsScreen';
import RuleScreen from '@/features/voice/RuleScreen';
import VoiceScreen from '@/features/voice/VoiceScreen';
import asModalRoute from '@/navigators/asModalRoute';

const LISTS = [
  { name: 'PromptButtonsScreen', component: PromptButtonsScreen },
  { name: 'FavoritesScreen', component: FavoritesScreen },
  { name: 'VoiceScreen', component: VoiceScreen },
];

// Each editor's modal route is wrapped once, here: a wrap inside a render would remount an open
// editor and lose its draft.
const EDITORS = [
  {
    name: 'PromptButtonScreen',
    component: PromptButtonScreen,
    modalComponent: asModalRoute(PromptButtonScreen),
    // One screen per prompt button, and one Add per placement.
    getId: ({ params }) => params?.id ?? `new:${params?.placement}`,
  },
  {
    name: 'FavoriteScreen',
    component: FavoriteScreen,
    modalComponent: asModalRoute(FavoriteScreen),
    // One screen per favorite, and one Add.
    getId: ({ params }) => params?.id ?? 'new',
  },
  {
    name: 'RuleScreen',
    component: RuleScreen,
    modalComponent: asModalRoute(RuleScreen),
    // One screen per rule, and one Add.
    getId: ({ params }) => String(params?.index ?? 'new'),
  },
];

const SHEET_OPTIONS = { presentation: 'modal' };

/**
 * The assistant's setup screens the chat opens (prompt buttons, Favorites, Writing as you), as
 * `Screen`s of the navigator that calls it. The lists are pushed; with `editorsAsSheets` (the root
 * stack) their editors open as sheets, else (the post editor's stack) they push too, so that from
 * inside its sheet they open in the sheet, never behind it or as a second sheet.
 */
export default function assistantScreens(Screen, { editorsAsSheets = false } = {}) {
  return (
    <>
      {LISTS.map(({ name, component }) => (
        <Screen key={name} name={name} component={component} />
      ))}
      {EDITORS.map(({ name, component, modalComponent, getId }) => (
        <Screen
          key={name}
          name={name}
          component={editorsAsSheets ? modalComponent : component}
          getId={getId}
          options={editorsAsSheets ? SHEET_OPTIONS : undefined}
        />
      ))}
    </>
  );
}
