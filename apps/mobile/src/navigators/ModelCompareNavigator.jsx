import ComparePickScreen from '@/features/model-compare/ComparePickScreen';
import CompareScreen from '@/features/model-compare/CompareScreen';
import ModalStackNavigator from '@/navigators/ModalStackNavigator';

// The blind model compare (Settings → Assistant → a model list → Compare): pick the models (and
// photos), then compare. Params `{ kind }` go to the pick screen.
export default function ModelCompareNavigator({ route }) {
  return (
    <ModalStackNavigator>
      <ModalStackNavigator.Screen name="ComparePickScreen" component={ComparePickScreen} initialParams={route.params} />
      <ModalStackNavigator.Screen name="CompareScreen" component={CompareScreen} />
    </ModalStackNavigator>
  );
}
