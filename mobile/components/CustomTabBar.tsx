import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const router = useRouter();

  if (!state || !state.routes) return null;

  const focusedRoute = state.routes[state.index];
  const focusedOptions = descriptors[focusedRoute.key]?.options as any;
  if (focusedOptions?.tabBarStyle?.display === 'none') return null;

  const visibleRoutes = state.routes.filter((route, index) => {
    const options: any = descriptors[route.key]?.options;
    return !(
      options?.href === null ||
      route.name.includes('scan') ||
      route.name === 'notification' ||
      route.name === '_sitemap' ||
      route.name === '+not-found'
    );
  });

  return (
    <View style={styles.container}>
      {/* PILL */}
      <View style={styles.pillContainer}>
        {visibleRoutes.map((route) => {
          const originalIndex = state.routes.findIndex(r => r.key === route.key);
          const isFocused = state.index === originalIndex;
          const options: any = descriptors[route.key]?.options;
          const label = options?.title ?? route.name;

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

          let iconName: any = 'home-outline';
          const n = route.name;
          if (n.includes('index') || n === 'index') iconName = isFocused ? 'home' : 'home-outline';
          else if (n.includes('progress')) iconName = isFocused ? 'stats-chart' : 'stats-chart-outline';
          else if (n.includes('profile')) iconName = isFocused ? 'person' : 'person-outline';

          if (isFocused) {
            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                style={styles.activeTab}
                activeOpacity={0.8}
              >
                <Ionicons name={iconName} size={18} color="#1a1a1a" />
                <Text style={styles.activeTabText} numberOfLines={1}>{label}</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.inactiveTab}
              activeOpacity={0.7}
            >
              <Ionicons name={iconName} size={22} color="#888" />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/scan')}
        activeOpacity={0.9}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 40,
    padding: 5,
    marginRight: 12,
    minWidth: 0,           // ← critical: allows flex children to shrink
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  activeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingVertical: 9,
    paddingHorizontal: 14,
    gap: 7,
    flexShrink: 0,         // ← never compress the label
    flexGrow: 0,           // ← never expand beyond content
  },
  activeTabText: {
    color: '#1a1a1a',
    fontWeight: '700',
    fontSize: 13,
  },
  inactiveTab: {
    flex: 1,               // ← each inactive tab gets equal share of remaining space
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    minWidth: 0,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    ...Platform.select({
      ios: { shadowColor: '#FF6B00', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 8 },
      android: { elevation: 10 },
    }),
  },
});