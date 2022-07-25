import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AssetIndexScreen from "screens/AssetIndexScreen";
import AssetDetailScreen from "screens/AssetDetailScreen";
import { dateToFromNowDaily } from "services/TimeService";

const StackNavigator = createNativeStackNavigator();

export default function AssetStackNavigator() {
  return (
    <StackNavigator.Navigator>
      <StackNavigator.Screen name="AssetIndex" component={AssetIndexScreen} options={{ title: "Assets" }} />
      <StackNavigator.Screen
        name="AssetDetail"
        component={AssetDetailScreen}
        options={({ route }) => ({ title: dateToFromNowDaily(route.params.asset.createdAt) })}
      />
    </StackNavigator.Navigator>
  );
}
