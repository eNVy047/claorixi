import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  ActivityIndicator, RefreshControl, Platform, Alert, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../lib/api';
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';
import { useNotifications } from '../../context/NotificationContext';
import { Swipeable } from 'react-native-gesture-handler';

type NotificationType = 'meal' | 'water' | 'activity' | 'sleep' | 'streak' | 'subscription' | 'admin' | 'achievement' | 'report' | 'reminder' | 'promo' | 'general';

interface Notification {
  _id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const NotificationScreen = () => {
  const router = useRouter();
  const { decrementUnreadCount, clearUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');

  const filters = ['All', 'Meals', 'Water', 'Activity', 'Sleep', 'Subscription', 'Admin'];

  const mapFilterToTypes = (filter: string): NotificationType[] => {
    switch (filter) {
      case 'Meals': return ['meal'];
      case 'Water': return ['water'];
      case 'Activity': return ['activity'];
      case 'Sleep': return ['sleep'];
      case 'Subscription': return ['subscription'];
      case 'Admin': return ['admin'];
      default: return []; // All
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/api/v1/notifications');
      if (response.data.success) {
        setNotifications(response.data.data);
      }
    } catch (error) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAllRead = async () => {
    try {
      // Optimistic Update
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      clearUnreadCount();
      await api.patch('/api/v1/notifications/read-all');
    } catch (error) {
      Alert.alert('Error', 'Could not mark all as read');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      // Optimistic Update
      const notifToDelete = notifications.find(n => n._id === id);
      setNotifications(prev => prev.filter(n => n._id !== id));
      if (notifToDelete && !notifToDelete.isRead) {
        decrementUnreadCount();
      }
      await api.delete(`/api/v1/notifications/${id}`);
    } catch (error) {
      Alert.alert('Error', 'Could not delete notification');
    }
  };

  const markRead = async (id: string, currentlyRead: boolean) => {
    if (currentlyRead) return;
    try {
      // Optimistic
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      decrementUnreadCount();
      await api.patch(`/api/v1/notifications/${id}/read`);
    } catch (error) {
      // Silent error
    }
  };

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'meal': return { emoji: '🍳' };
      case 'water': return { emoji: '💧' };
      case 'activity': return { emoji: '🏃' };
      case 'sleep': return { emoji: '🌙' };
      case 'streak': return { emoji: '🔥' };
      case 'subscription': return { emoji: '⏰' };
      case 'admin': return { emoji: '📢' };
      default: return { emoji: '🔔' }; // general, report, achievement etc
    }
  };

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'All') return notifications;
    const allowedTypes = mapFilterToTypes(activeFilter);
    return notifications.filter(n => allowedTypes.includes(n.type));
  }, [notifications, activeFilter]);

  const groupedNotifications = useMemo(() => {
    const groups = [
      { title: 'Today', data: [] as Notification[] },
      { title: 'Yesterday', data: [] as Notification[] },
      { title: 'This Week', data: [] as Notification[] },
      { title: 'Earlier', data: [] as Notification[] },
    ];

    filteredNotifications.forEach(n => {
      const date = parseISO(n.createdAt);
      if (isToday(date)) groups[0].data.push(n);
      else if (isYesterday(date)) groups[1].data.push(n);
      else if (isThisWeek(date)) groups[2].data.push(n);
      else groups[3].data.push(n);
    });

    return groups.filter(g => g.data.length > 0);
  }, [filteredNotifications]);

  const hasUnread = notifications.some(n => !n.isRead);

  // Memoized individual card for better performance
  const NotificationCard = React.memo(({ item }: { item: Notification }) => {
    const { emoji } = getTypeIcon(item.type);
    
    const renderRightActions = (progress: any, dragX: any) => {
      const trans = dragX.interpolate({
        inputRange: [-80, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      });
      return (
        <TouchableOpacity style={styles.deleteBtnWrapper} onPress={() => deleteNotification(item._id)}>
          <Animated.View style={[styles.deleteBtnAction, { opacity: trans }]}>
            <Ionicons name="trash" size={24} color="#FFF" />
          </Animated.View>
        </TouchableOpacity>
      );
    };

    return (
      <Swipeable renderRightActions={renderRightActions}>
        <TouchableOpacity 
          style={[styles.notificationCard, !item.isRead ? styles.cardUnread : styles.cardRead]}
          onPress={() => markRead(item._id, item.isRead)}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            {!item.isRead && <View style={styles.unreadDotIndicator} />}
            <Text style={styles.emojiIcon}>{emoji}</Text>
            
            <View style={styles.contentContainer}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, !item.isRead && styles.boldText]} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.time}>{formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true })}</Text>
              </View>
              <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  });

  if (loading && notifications.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF8C00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        {hasUnread && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markReadText}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* FILTER CHIPS */}
      <View style={styles.filterContainer}>
        <FlatList
          data={filters}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.filterChip, activeFilter === item && styles.activeChip]}
              onPress={() => setActiveFilter(item)}
            >
              <Text style={[styles.filterText, activeFilter === item && styles.activeFilterText]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={item => item}
          contentContainerStyle={styles.filterList}
        />
      </View>

      {/* LIST */}
      {groupedNotifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={64} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>You're all caught up! 🎉</Text>
          <Text style={styles.emptySub}>No new notifications at the moment.</Text>
        </View>
      ) : (
        <FlatList
          data={groupedNotifications}
          keyExtractor={(item) => item.title}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContainer}
          initialNumToRender={5}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={({ item }) => (
            <View style={styles.groupContainer}>
              <Text style={styles.groupTitle}>{item.title}</Text>
              {item.data.map(notif => (
                <NotificationCard key={notif._id} item={notif} />
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4F0',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F4F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 10,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  markReadText: {
    fontSize: 14,
    color: '#FF8C00',
    fontWeight: '600',
  },
  filterContainer: {
    backgroundColor: '#FFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE0',
  },
  filterList: {
    paddingHorizontal: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    marginRight: 10,
  },
  activeChip: {
    backgroundColor: '#FF8C00',
  },
  filterText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  activeFilterText: {
    color: '#FFF',
  },
  listContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  groupContainer: {
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#888',
    marginBottom: 10,
  },
  notificationCard: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardUnread: {
    backgroundColor: '#F0EBE0',
  },
  cardRead: {
    backgroundColor: '#FFF',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadDotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF8C00',
    marginRight: 8,
  },
  emojiIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  boldText: {
    fontWeight: 'bold',
  },
  message: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  time: {
    fontSize: 12,
    color: '#999',
  },
  deleteBtnWrapper: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'flex-end',
    borderRadius: 16,
    marginBottom: 10,
    width: 80,
  },
  deleteBtnAction: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
});

export default NotificationScreen;
