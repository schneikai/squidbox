import RandomSuggestionsScreen from '@/features/post-random-suggestions/RandomSuggestionsScreen';
import ModalStackNavigator from '@/navigators/ModalStackNavigator';

export default function RandomSuggestionsNavigator({ route }) {
  return (
    <ModalStackNavigator>
      <ModalStackNavigator.Screen
        name="RandomSuggestionsScreen"
        component={RandomSuggestionsScreen}
        initialParams={route.params}
      />
    </ModalStackNavigator>
  );
}
