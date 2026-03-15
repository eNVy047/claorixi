import React from 'react';
import { Tabs } from 'expo-router';
import CustomTabBar from '../../components/CustomTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen
        name="(dashboard)/index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="(dashboard)/progress"
        options={{
          title: 'Progress',
        }}
      />
      <Tabs.Screen
        name="notification"
        options={{
          title: 'Notification',
        }}
      />
      <Tabs.Screen
        name="(dashboard)/profile"
        options={{
          title: 'Profile',
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          href: null, // Hide from tab bar
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
