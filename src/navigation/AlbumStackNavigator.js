import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AlbumIndexScreen from "screens/AlbumIndexScreen";
import AlbumDetailScreen from "screens/AlbumDetailScreen";
import AssetDetailScreen from "screens/AssetDetailScreen";
import { dateToFromNowDaily } from "services/TimeService";

const StackNavigator = createNativeStackNavigator();

export default function AlbumStackNavigator() {
  return (
    <StackNavigator.Navigator>
      <StackNavigator.Screen name="AlbumIndex" component={AlbumIndexScreen} options={{ title: "Albums" }} />
      <StackNavigator.Screen
        name="AlbumDetail"
        component={AlbumDetailScreen}
        options={({ route }) => ({ title: route.params.album.name })}
      />
      <StackNavigator.Screen
        name="AssetDetail"
        component={AssetDetailScreen}
        options={({ route }) => ({ title: dateToFromNowDaily(route.params.asset.createdAt) })}
      />
    </StackNavigator.Navigator>
  );
}
