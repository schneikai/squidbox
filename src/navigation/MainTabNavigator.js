import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AntDesign, Ionicons } from "@expo/vector-icons";

import AssetStackNavigator from "navigation/AssetStackNavigator";
import AlbumStackNavigator from "navigation/AlbumStackNavigator";
import PostStackNavigator from "navigation/PostStackNavigator";
import SettingsScreen from "screens/SettingsScreen";

const TabNavigator = createBottomTabNavigator();

export default function MainTabNavigator() {
  return (
    <TabNavigator.Navigator screenOptions={{ tabBarActiveTintColor: "dodgerblue", tabBarInactiveTintColor: "gray" }}>
      <TabNavigator.Screen
        name="Assets"
        component={AssetStackNavigator}
        options={{
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={iconName("image", focused)} size={size} color={color} />
          ),
        }}
      />
      <TabNavigator.Screen
        name="Albums"
        component={AlbumStackNavigator}
        options={{
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={iconName("albums", focused)} size={size} color={color} />
          ),
        }}
      />
      <TabNavigator.Screen
        name="Posts"
        component={PostStackNavigator}
        options={{
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={iconName("newspaper", focused)} size={size} color={color} />
          ),
        }}
      />
      <TabNavigator.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={iconName("settings", focused)} size={size} color={color} />
          ),
        }}
      />
    </TabNavigator.Navigator>
  );
}

function iconName(name, focused) {
  return focused ? name : `${name}-outline`;
}
