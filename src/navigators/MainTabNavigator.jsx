import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import AlbumNavigator from '@/navigators/AlbumNavigator';
import AssetNavigator from '@/navigators/AssetNavigator';
import PostNavigator from '@/navigators/PostNavigator';
import SettingsNavigator from '@/navigators/SettingsNavigator';

const Tab = createBottomTabNavigator();

export default function RootTabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="AssetsTab"
        component={AssetNavigator}
        options={{
          title: 'Assets',
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={iconName('image', focused)} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AlbumsTab"
        component={AlbumNavigator}
        options={{
          title: 'Albums',
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={iconName('albums', focused)} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="PostsTab"
        component={PostNavigator}
        options={{
          title: 'Posts',
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={iconName('create', focused)} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsNavigator}
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={iconName('settings', focused)} size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function iconName(name, focused) {
  return focused ? name : `${name}-outline`;
}
