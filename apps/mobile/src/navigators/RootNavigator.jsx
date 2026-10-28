import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AssetPickerScreen from '@/features/asset-picker/AssetPickerScreen';
import InstructionScreen from '@/features/instructions/InstructionScreen';
import InstructionsScreen from '@/features/instructions/InstructionsScreen';
import AddModelsScreen from '@/features/model-compare/AddModelsScreen';
import AddEditPostNavigator from '@/navigators/AddEditPostNavigator';
import CreatePostNavigator from '@/navigators/CreatePostNavigator';
import MainTabNavigator from '@/navigators/MainTabNavigator';
import ModelCompareNavigator from '@/navigators/ModelCompareNavigator';
import asModalRoute from '@/navigators/asModalRoute';
import assistantScreens from '@/navigators/assistantScreens';
import AddToAlbumScreen from '@/screens/AddToAlbumScreen';
import AlbumNotesScreen from '@/screens/AlbumNotesScreen';
import AlbumScreen from '@/screens/AlbumScreen';
import AssetScreen from '@/screens/AssetScreen';
import PostScreen from '@/screens/PostScreen';

const RootStack = createNativeStackNavigator();

const CreatePostModalRoute = asModalRoute(CreatePostNavigator);
const AddEditPostModalRoute = asModalRoute(AddEditPostNavigator);
const AssetPickerModalRoute = asModalRoute(AssetPickerScreen);
const AddToAlbumModalRoute = asModalRoute(AddToAlbumScreen);
const ModelCompareModalRoute = asModalRoute(ModelCompareNavigator);
const AddAiModelsModalRoute = asModalRoute(AddModelsScreen);
const InstructionModalRoute = asModalRoute(InstructionScreen);
const AlbumNotesModalRoute = asModalRoute(AlbumNotesScreen);

// One editor per params: opening the editor for another post or other assets, also from inside an
// open editor's sheet, opens a new one on top; the same params go back to the editor that has them.
const editorId = ({ params }) => JSON.stringify(params ?? {});

// One screen per post: opening another post opens it on top, the same post goes back to its screen
// (so a double tap opens it once).
const postId = ({ params }) => params?.postId;

// One compare and one Add screen per kind of model.
const modelKind = ({ params }) => params?.kind;

// One screen per kind of instructions.
const instructionKind = ({ params }) => params?.kind;

export default function RootNavigator() {
  return (
    <RootStack.Navigator
      initialRouteName="MainTab"
      screenOptions={{ contentStyle: { backgroundColor: 'transparent' } }}
    >
      <RootStack.Group screenOptions={{ presentation: 'modal', headerShown: false }}>
        <RootStack.Screen name="CreatePostModal" component={CreatePostModalRoute} />
        <RootStack.Screen name="AddEditPostModal" component={AddEditPostModalRoute} getId={editorId} />
        <RootStack.Screen name="AssetPickerModal" component={AssetPickerModalRoute} />
        <RootStack.Screen name="AddToAlbumModal" component={AddToAlbumModalRoute} />
        <RootStack.Screen name="ModelCompareModal" component={ModelCompareModalRoute} getId={modelKind} />
        <RootStack.Screen name="AddAiModelsModal" component={AddAiModelsModalRoute} getId={modelKind} />
        <RootStack.Screen name="InstructionScreen" component={InstructionModalRoute} getId={instructionKind} />
        <RootStack.Screen name="AlbumNotesScreen" component={AlbumNotesModalRoute} />
      </RootStack.Group>
      <RootStack.Group screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="MainTab" component={MainTabNavigator} />
        <RootStack.Screen name="AlbumScreen" component={AlbumScreen} />
        <RootStack.Screen name="PostScreen" component={PostScreen} getId={postId} />
        <RootStack.Screen name="AssetScreen" component={AssetScreen} />
        <RootStack.Screen name="InstructionsScreen" component={InstructionsScreen} />
        {assistantScreens(RootStack.Screen, { editorsAsSheets: true })}
      </RootStack.Group>
    </RootStack.Navigator>
  );
}
