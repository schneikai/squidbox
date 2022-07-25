import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "navigation/MainTabNavigator";
import MediaLibrary from "components/MediaLibrary";
import AssetLibrary from "components/AssetLibrary";
import AlbumLibrary from "components/AlbumLibrary";
import NewPostScreen from "screens/NewPostScreen";

const RootStack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Main" component={RootStackMainScreen} />
        <RootStack.Screen name="MediaLibrary" component={MediaLibrary} options={{ presentation: "modal" }} />
        <RootStack.Screen name="AssetLibrary" component={AssetLibrary} options={{ presentation: "modal" }} />
        <RootStack.Screen name="AlbumLibrary" component={AlbumLibrary} options={{ presentation: "modal" }} />
        <RootStack.Screen
          name="NewPost"
          component={NewPostScreen}
          options={({ route }) => ({
            presentation: "modal",
            headerShown: true,
            title: route?.params?.post ? "Edit Post" : "New Post",
          })}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

function RootStackMainScreen() {
  return <MainTabNavigator />;
}
