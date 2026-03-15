import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const router = useRouter();

  if (!state || !state.routes) return null;

  // Check if current screen wants to hide the tab bar
  const focusedRoute = state.routes[state.index];
  const focusedDescriptor = descriptors[focusedRoute.key];
  const focusedOptions = focusedDescriptor?.options as any;

  if (focusedOptions?.tabBarStyle?.display === 'none') {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* THE PILL */}
      <View style={styles.pillContainer}>
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          if (!descriptor) return null;

          const options: any = descriptor.options;
          
          // Skip routes that should be hidden (like 'scan')
          if (options?.href === null || 
              route.name.includes('scan') || 
              route.name === 'notification' ||
              route.name === '_sitemap' ||
              route.name === '+not-found'
          ) return null;

          const label = options.title !== undefined ? options.title : route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // Map icons
          let iconName: any = 'home-outline';
          if (route.name === '(dashboard)/index' || route.name === 'index') iconName = isFocused ? 'home' : 'home-outline';
          if (route.name === '(dashboard)/progress' || route.name === 'progress') iconName = isFocused ? 'stats-chart' : 'stats-chart-outline';
          if (route.name === 'notification') iconName = isFocused ? 'notifications' : 'notifications-outline';
          if (route.name === '(dashboard)/profile' || route.name === 'profile') iconName = isFocused ? 'person' : 'person-outline';

          if (isFocused) {
            return (
              <TouchableOpacity
                key={route.name}
                onPress={onPress}
                style={styles.activeTabPill}
                activeOpacity={0.8}
              >
                <Ionicons name={iconName} size={20} color="#1a1a1a" />
                <Text style={styles.activeTabText}>{label}</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={route.name}
              onPress={onPress}
              style={styles.inactiveTab}
              activeOpacity={0.7}
            >
              <Ionicons name={iconName} size={24} color="#888" />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* FLOATING ACTION BUTTON */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => router.push('/(tabs)/scan')}
        activeOpacity={0.9}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30, // Elevated from bottom
    width: '100%',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Push pill left and FAB right
  },
  pillContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 40,
    padding: 6,
    alignItems: 'center',
    flex: 1, // Take up remaining space
    marginRight: 15,
    // Shadow for pill
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  activeTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 4,
  },
  activeTabText: {
    color: '#1a1a1a',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },
  inactiveTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  fab: {
    width: 65,
    height: 65,
    borderRadius: 33,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    // High elevation/shadow for FAB
    ...Platform.select({
      ios: {
        shadowColor: '#FF6B00',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
});
