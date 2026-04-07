import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useGoals } from '../../../context/GoalContext';
import TodayTab from '../../../components/progress_tabs/TodayTab';
import WeekTab from '../../../components/progress_tabs/WeekTab';
import MonthTab from '../../../components/progress_tabs/MonthTab';
import YearTab from '../../../components/progress_tabs/YearTab';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '../../../lib/api';

const { width } = Dimensions.get('window');
const SCREEN_BG = '#F5F0E8';
const CARD_BG = '#fff';
const ORANGE = '#FF8C00';
const YELLOW = '#FFD700';
const GREEN = '#4CD964';
const BLUE = '#4FC3F7';



export default function ProgressScreen() {
  const router = useRouter();
  const { goals } = useGoals();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Today');
  const [data, setData] = useState<any>(null);

  // Sleep Logging State
  const [showPicker, setShowPicker] = useState<'bed' | 'wake' | null>(null);
  const [bedtime, setBedtime] = useState(new Date());
  const [wakeTime, setWakeTime] = useState(new Date());

  const filterTabs = ['Today', 'Week', 'Month', 'Year'];

  const fetchProgress = async () => {
    try {
      const response = await api.get(`/api/v1/progress?filter=${activeTab.toLowerCase()}`);
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProgress();
    }, [activeTab])
  );

  const logMood = async (mood: string) => {
    try {
      const date = format(new Date(), 'yyyy-MM-dd');
      const response = await api.patch('/api/v1/progress/mood', { date, mood });
      if (response.data.success) {
        fetchProgress();
        Alert.alert('Success', 'Mood logged for today!');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not log mood');
    }
  };

  const handleSleepUpdate = async (type: 'bed' | 'wake', selectedDate?: Date) => {
    setShowPicker(null);
    if (!selectedDate) return;

    if (type === 'bed') setBedtime(selectedDate);
    else setWakeTime(selectedDate);

    // If both are set, log it
    try {
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const bedStr = format(type === 'bed' ? selectedDate : bedtime, 'HH:mm');
      const wakeStr = format(type === 'wake' ? selectedDate : wakeTime, 'HH:mm');

      await api.patch('/api/v1/progress/sleep', {
        date: dateStr,
        bedtime: bedStr,
        wakeTime: wakeStr
      });
      fetchProgress();
    } catch (error) {
      console.error('Error logging sleep:', error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  const latestLog = data?.logs?.[data.logs.length - 1] || {};
  const safeCalorieGoal = goals?.calorieGoal || 2000;
  const safeBurnGoal = goals?.caloriesBurntGoal || 300;
  const safeProteinGoal = goals?.proteinGoal || 150;
  const safeCarbsGoal = goals?.carbsGoal || 200;
  const safeFatGoal = goals?.fatGoal || 67;
  const safeStepGoal = goals?.stepGoal || 10000;
  const safeWaterGoal = goals?.waterGlasses || 8;
  const safeSleepGoal = goals?.sleepGoal || 8;

  const consumedProgress = Math.min((latestLog.caloriesConsumed || 0) / safeCalorieGoal, 1);
  const burntProgress = Math.min((latestLog.caloriesBurnt || 0) / safeBurnGoal, 1);
  const netProgress = Math.min(((latestLog.caloriesConsumed || 0) - (latestLog.caloriesBurnt || 0)) / safeCalorieGoal, 1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProgress(); }} tintColor="#FF8C00" />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Progress</Text>
        <View style={styles.tabContainer}>
          {filterTabs.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {activeTab === 'Today' && (
        <>
          <TodayTab data={data} goals={goals} />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mood Tracker</Text>
            <View style={styles.moodContainer}>
              {['happy', 'neutral', 'sad', 'angry', 'tired'].map(m => (
                <TouchableOpacity key={m} style={[styles.moodBtn, latestLog.mood === m && styles.activeMood]} onPress={() => logMood(m)}>
                  <Text style={styles.moodEmoji}>{getEmoji(m)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Sleep Logger</Text>
              <View style={styles.sleepActions}>
                <TouchableOpacity onPress={() => setShowPicker('bed')} style={styles.sleepBtn}>
                  <Ionicons name="moon-outline" size={16} color="#FF8C00" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowPicker('wake')} style={[styles.sleepBtn, { marginLeft: 10 }]}>
                  <Ionicons name="sunny-outline" size={16} color="#FF8C00" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.sleepScoreContainer}>
              <Text style={styles.bigVal}>{latestLog.sleepScore || 0}%</Text>
              <Text style={styles.subVal}>Quality Score</Text>
            </View>
            <Text style={styles.statSub}>Total Sleep: {latestLog.sleepHours || 0}h / {safeSleepGoal}h goal</Text>
            {latestLog.bedtime && <Text style={styles.statSub}>Bedtime: {latestLog.bedtime} | Wake: {latestLog.wakeTime}</Text>}
          </View>

          {showPicker && (
            <DateTimePicker
              value={showPicker === 'bed' ? bedtime : wakeTime}
              mode="time"
              is24Hour={true}
              onChange={(event, date) => handleSleepUpdate(showPicker, date)}
            />
          )}
        </>
      )}

      {activeTab === 'Week' && <WeekTab data={data} goals={goals} />}
      {activeTab === 'Month' && <MonthTab data={data} goals={goals} />}
      {activeTab === 'Year' && <YearTab data={data} goals={goals} />}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}



const getEmoji = (mood: string) => {
  switch (mood) {
    case 'happy': return '😄';
    case 'neutral': return '😐';
    case 'sad': return '😔';
    case 'angry': return '😤';
    case 'tired': return '😴';
    default: return '❓';
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SCREEN_BG },
  content: { paddingTop: Platform.OS === 'ios' ? 70 : 50, paddingHorizontal: 20 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 30 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#EAE1D3', borderRadius: 25, padding: 5 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 20 },
  activeTab: { backgroundColor: ORANGE },
  tabText: { color: '#888', fontWeight: '600' },
  activeTabText: { color: '#FFF' },
  card: { backgroundColor: CARD_BG, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  bigVal: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  subVal: { color: '#888', fontSize: 14 },
  statSub: { color: '#888', fontSize: 12, marginTop: 4 },
  moodContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: { width: 50, height: 50, backgroundColor: '#F5F0E8', borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  activeMood: { backgroundColor: 'rgba(255,140,0,0.1)', borderColor: ORANGE, borderWidth: 1 },
  moodEmoji: { fontSize: 24 },
  sleepScoreContainer: { alignItems: 'center', marginBottom: 10 },
  sleepActions: { flexDirection: 'row' },
  sleepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F0E8', justifyContent: 'center', alignItems: 'center' }
});
