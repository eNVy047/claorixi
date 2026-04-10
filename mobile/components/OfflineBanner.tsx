import React from 'react';
import { View, Text, StyleSheet, Animated, Platform, StatusBar } from 'react-native';
import { useOffline } from '../context/OfflineContext';
import { useGoalStore } from '../store/useGoalStore';

export const OfflineBanner = () => {
  const { isOffline } = useOffline();
  const isSyncing = useGoalStore(state => state.isSyncing);
  const translateY = React.useRef(new Animated.Value(-100)).current;

  React.useEffect(() => {
    Animated.spring(translateY, {
      toValue: (isOffline || isSyncing) ? 0 : -100,
      useNativeDriver: true,
      tension: 40,
      friction: 7,
    }).start();
  }, [isOffline, isSyncing]);

  if (!isOffline && !isSyncing) return null;

  return (
    <Animated.View style={[
      styles.container, 
      { transform: [{ translateY }] },
      isSyncing && !isOffline ? styles.syncingBg : styles.offlineBg
    ]}>
      <Text style={styles.text}>
        {isOffline 
          ? "No internet connection • Data will sync when online" 
          : "Syncing your data..."}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 20,
    paddingBottom: 10,
    paddingHorizontal: 20,
    zIndex: 9999,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineBg: {
    backgroundColor: '#666',
  },
  syncingBg: {
    backgroundColor: '#FF8C00',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
