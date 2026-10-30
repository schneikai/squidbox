import FavoriteScreen from '@/features/favorites/FavoriteScreen';
import FavoritesScreen from '@/features/favorites/FavoritesScreen';
import PromptButtonScreen from '@/features/prompt-buttons/PromptButtonScreen';
import PromptButtonsScreen from '@/features/prompt-buttons/PromptButtonsScreen';
import RuleScreen from '@/features/voice/RuleScreen';
import RulesScreen from '@/features/voice/RulesScreen';
import VoiceScreen from '@/features/voice/VoiceScreen';

// One screen per prompt button, and one Add.
const promptButtonId = ({ params }) => params?.id ?? 'new';

// One screen per favorite, and one Add.
const favoriteId = ({ params }) => params?.id ?? 'new';

// One screen per rule, and one Add.
const ruleIndex = ({ params }) => String(params?.index ?? 'new');

/**
 * The assistant's setup screens the chat opens (prompt buttons, Favorites, Writing as you), as
 * `Screen`s of the navigator that calls it: the root stack, and the post editor's stack, so that from
 * inside its sheet they open in the sheet rather than behind it.
 */
export default function assistantScreens(Screen) {
  return (
    <>
      <Screen name="PromptButtonsScreen" component={PromptButtonsScreen} />
      <Screen name="PromptButtonScreen" component={PromptButtonScreen} getId={promptButtonId} />
      <Screen name="FavoritesScreen" component={FavoritesScreen} />
      <Screen name="FavoriteScreen" component={FavoriteScreen} getId={favoriteId} />
      <Screen name="VoiceScreen" component={VoiceScreen} />
      <Screen name="RulesScreen" component={RulesScreen} />
      <Screen name="RuleScreen" component={RuleScreen} getId={ruleIndex} />
    </>
  );
}
