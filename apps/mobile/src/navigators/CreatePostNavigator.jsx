import ModalStackNavigator from '@/navigators/ModalStackNavigator';
import CreatePostScreen from '@/screens/CreatePostScreen';
import IgnoredPostsScreen from '@/screens/IgnoredPostsScreen';

export default function CreatePostNavigator() {
  return (
    <ModalStackNavigator>
      <ModalStackNavigator.Screen name="CreatePostScreen" component={CreatePostScreen} />
      <ModalStackNavigator.Screen name="IgnoredPostsScreen" component={IgnoredPostsScreen} />
    </ModalStackNavigator>
  );
}
