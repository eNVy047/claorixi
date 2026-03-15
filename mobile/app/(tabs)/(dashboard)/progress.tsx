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
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '../../../lib/api';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useGoals } from '../../../context/GoalContext';

const { width } = Dimensions.get('window');
const SCREEN_BG = '#F5F0E8';
const CARD_BG = '#fff';
const ORANGE = '#FF8C00';
const YELLOW = '#FFD700';
const GREEN = '#4CD964';
const BLUE = '#4FC3F7';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface RingProps {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
  radius: number;
}

const ProgressRing = ({ progress, size, strokeWidth, color, radius }: RingProps) => {
  const animatedProgress = useSharedValue(0);
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    animatedProgress.value = withTiming(progress, { duration: 1000 });
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  return (
    <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="transparent"
        opacity={0.1}
      />
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="transparent"
        strokeDasharray={`${circumference} ${circumference}`}
        animatedProps={animatedProps}
        strokeLinecap="round"
      />
    </G>
  );
};

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
  const consumedProgress = Math.min((latestLog.caloriesConsumed || 0) / (goals.calorieGoal || 2000), 1);
  const burntProgress = Math.min((latestLog.caloriesBurnt || 0) / (goals.caloriesBurntGoal || 300), 1);
  const netProgress = Math.min(((latestLog.caloriesConsumed || 0) - (latestLog.caloriesBurnt || 0)) / (goals.calorieGoal || 2000), 1);

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

      <View style={styles.ringsSection}>
        <View style={styles.ringsContainer}>
          <Svg width={220} height={220} viewBox="0 0 220 220">
            <ProgressRing progress={consumedProgress} size={220} strokeWidth={18} color={ORANGE} radius={85} />
            <ProgressRing progress={burntProgress} size={220} strokeWidth={18} color={YELLOW} radius={62} />
            <ProgressRing progress={netProgress} size={220} strokeWidth={18} color={GREEN} radius={39} />
          </Svg>
          <View style={styles.ringsLabel}>
            <Text style={styles.ringsLabelVal}>{latestLog.caloriesConsumed || 0}</Text>
            <Text style={styles.ringsLabelSub}>Consumed</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <StatItem dotColor={ORANGE} val={latestLog.caloriesConsumed || 0} label="Consumed" />
          <StatItem dotColor={YELLOW} val={latestLog.caloriesBurnt || 0} label="Burnt" />
          <StatItem dotColor={GREEN} val={(latestLog.caloriesConsumed || 0) - (latestLog.caloriesBurnt || 0)} label="Net" />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Macros</Text>
        <MacroBar label="Protein" val={latestLog.proteinConsumed || 0} goal={goals.proteinGoal} color={ORANGE} unit="g" />
        <MacroBar label="Carbs" val={latestLog.carbsConsumed || 0} goal={goals.carbsGoal} color={YELLOW} unit="g" />
        <MacroBar label="Fat" val={latestLog.fatConsumed || 0} goal={goals.fatGoal} color={GREEN} unit="g" />
      </View>

      <View style={styles.row}>
        <MetricCard title="Steps" val={latestLog.steps || 0} sub={`of ${goals.stepGoal.toLocaleString()}`} progress={(latestLog.steps || 0) / goals.stepGoal * 100} color={ORANGE} />
        <MetricCard title="Water" val={latestLog.waterGlasses || 0} sub={`of ${goals.waterGlasses} glasses`} progress={(latestLog.waterGlasses || 0) / goals.waterGlasses * 100} color={BLUE} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Daily Streak</Text>
          <Text style={styles.streakText}>🔥 {data?.summary?.currentStreak || 0} days</Text>
        </View>
        <View style={styles.streakHistory}>
          {[...Array(7)].map((_, i) => (
            <View key={i} style={[styles.streakDot, i < (data?.summary?.currentStreak || 0) ? styles.activeStreak : styles.inactiveStreak]} />
          ))}
        </View>
      </View>

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
          <Text style={styles.cardTitle}>Sleep</Text>
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
        <Text style={styles.statSub}>Total Sleep: {latestLog.sleepHours || 0}h / {goals.sleepGoal}h goal</Text>
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

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const MacroBar = ({ label, val, goal, color, unit }: any) => (
  <View style={styles.macroRow}>
    <View style={styles.macroHeader}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroVal}>{val}{unit} / {goal}{unit}</Text>
    </View>
    <View style={styles.macroBarBg}>
      <View style={[styles.macroBarFill, { width: `${Math.min((val / goal) * 100, 100)}%`, backgroundColor: color }]} />
    </View>
  </View>
);

const StatItem = ({ dotColor, val, label }: any) => (
  <View style={styles.statItem}>
    <View style={[styles.dot, { backgroundColor: dotColor }]} />
    <Text style={styles.statVal}>{val} kcal</Text>
    <Text style={styles.statSub}>{label}</Text>
  </View>
);

const MetricCard = ({ title, val, sub, progress, color }: any) => (
  <View style={[styles.card, { flex: 1, marginHorizontal: 5 }]}>
    <Text style={styles.cardTitle}>{title}</Text>
    <Text style={styles.bigVal}>{val}</Text>
    <Text style={styles.subVal}>{sub}</Text>
    <View style={styles.miniProgress}>
      <View style={[styles.miniBar, { width: `${Math.min(progress, 100)}%`, backgroundColor: color }]} />
    </View>
  </View>
);

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
  ringsSection: { alignItems: 'center', marginBottom: 30 },
  ringsContainer: { justifyContent: 'center', alignItems: 'center', position: 'relative' },
  ringsLabel: { position: 'absolute', alignItems: 'center' },
  ringsLabelVal: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  ringsLabelSub: { fontSize: 12, color: '#888', textTransform: 'uppercase' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 20 },
  statItem: { alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  statVal: { color: '#333', fontWeight: 'bold', fontSize: 14 },
  statSub: { color: '#888', fontSize: 12, marginTop: 4 },
  card: { backgroundColor: CARD_BG, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  bigVal: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  subVal: { color: '#888', fontSize: 14 },
  miniProgress: { height: 4, backgroundColor: '#F0E6D2', borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  miniBar: { height: '100%', borderRadius: 2 },
  macroRow: { marginBottom: 15 },
  macroHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  macroLabel: { color: '#333', fontSize: 14, fontWeight: '500' },
  macroVal: { color: '#888', fontSize: 12 },
  macroBarBg: { height: 8, backgroundColor: '#F0E6D2', borderRadius: 4, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: -5 },
  streakHistory: { flexDirection: 'row', justifyContent: 'space-between' },
  streakDot: { width: width * 0.1, height: 8, borderRadius: 4 },
  activeStreak: { backgroundColor: GREEN },
  inactiveStreak: { backgroundColor: '#F0E6D2' },
  streakText: { color: GREEN, fontWeight: 'bold' },
  moodContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: { width: 50, height: 50, backgroundColor: '#F5F0E8', borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  activeMood: { backgroundColor: 'rgba(255,140,0,0.1)', borderColor: ORANGE, borderWidth: 1 },
  moodEmoji: { fontSize: 24 },
  sleepScoreContainer: { alignItems: 'center', marginBottom: 10 },
  sleepActions: { flexDirection: 'row' },
  sleepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F0E8', justifyContent: 'center', alignItems: 'center' }
});
