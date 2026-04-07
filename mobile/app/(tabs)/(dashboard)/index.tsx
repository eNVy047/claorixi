import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Image, Animated, AppState, ActivityIndicator,
  Alert, Modal, TextInput, StyleSheet, Platform, PanResponder
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle, G, Text as SvgText } from 'react-native-svg';
import { Pedometer } from 'expo-sensors';
import { api } from '../../../lib/api';
import { useGoals } from '../../../context/GoalContext';
import { useNotifications } from '../../../context/NotificationContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, startOfWeek, addDays, isToday, isFuture, parseISO } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { setStepsForBackgroundSync } from '../../../lib/stepsBackground';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    // Add banner and list for newer SDK versions
    shouldShowBanner: true,
    shouldShowList: true,
  } as any),
});

// Define notification categories for interactive buttons
Notifications.setNotificationCategoryAsync('workout-checkin', [
  {
    identifier: 'yes',
    buttonTitle: 'Yes, I did! 💪',
    options: { opensAppToForeground: true },
  },
  {
    identifier: 'remind-later',
    buttonTitle: 'Remind me later ⏰',
    options: { opensAppToForeground: false },
  },
  {
    identifier: 'no',
    buttonTitle: 'Not yet',
    options: { opensAppToForeground: false },
  },
]);

Notifications.setNotificationCategoryAsync('workout-checkin-final', [
  {
    identifier: 'yes',
    buttonTitle: 'Yes, log it ✅',
    options: { opensAppToForeground: true },
  },
  {
    identifier: 'no',
    buttonTitle: 'No, skip today',
    options: { opensAppToForeground: false },
  },
]);

const DATE_STORAGE_KEY = 'lastKnownDate';

type DailyLog = {
  date: string;
  calorieGoal: number;
  caloriesConsumed: number;
  proteinGoal: number;
  proteinConsumed: number;
  fatGoal: number;
  fatConsumed: number;
  carbsGoal: number;
  carbsConsumed: number;
  waterGlasses: number;
  waterGoal: number;
  caloriesBurnt: number;
  stepGoal: number;
  goalMet?: boolean;
};

type WeekDay = {
  date: string;         // YYYY-MM-DD
  label: string;        // 'Sun', 'Mon', ...
  dayNum: string;       // '01', '02', ...
  goalMet: boolean | null;  // null = future, true/false = past
  hasData: boolean;
};

type ActivityLog = {
  steps: number;
  stepCalories: number;
  totalCaloriesBurnt: number;
  activeMinutes: number;
  distance: number;
  exercises: {
    _id: string;
    name: string;
    duration: number;
    caloriesBurnt: number;
    sets?: number;
    reps?: number;
    isRoutine?: boolean;
    fromRoutine?: boolean;
  }[];
  bedtime?: string;
  wakeTime?: string;
  sleepHours?: number;
  sleepQuality?: string;
};

type Routine = {
  _id: string;
  exerciseName: string;
  duration: number;
  met: number;
  sets?: number;
  reps?: number;
  days: string[];
};

type Exercise = {
  name: string;
  met: number;
  category: string;
};

export default function DashboardScreen() {
  const router = useRouter();
  const { goals } = useGoals();
  const { unreadCount } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [log, setLog] = useState<DailyLog | null>(null);
  const [activity, setActivity] = useState<ActivityLog | null>(null);
  const [activeTab, setActiveTab] = useState<'Meals' | 'Activities'>('Meals');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [initials, setInitials] = useState('?');
  const [userWeight, setUserWeight] = useState(70);
  const [userHeightCm, setUserHeightCm] = useState(170);

  // Calendar state
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const todayDate = format(new Date(), 'yyyy-MM-dd');
  const isTodaySelected = selectedDate === todayDate;

  // Animated fade for card transitions
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Notification listeners refs
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  // Steps state
  const [currentStepCount, setCurrentStepCount] = useState(0);
  const lastStepWasBelowThresholdRef = useRef(true);
  const lastStepAtMsRef = useRef(0);
  const lastStepDayRef = useRef<string>(format(new Date(), 'yyyy-MM-dd'));

  // Exercise Logging Modal State
  const [isLogModalVisible, setIsLogModalVisible] = useState(false);
  const [exerciseLibrary, setExerciseLibrary] = useState<Exercise[]>([]);

  // Push Notifications Listeners
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification Received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      handleNotificationResponse(response);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);


  const handleNotificationResponse = async (response: Notifications.NotificationResponse) => {
    const actionId = response.actionIdentifier;
    const data: any = response.notification.request.content.data || {};
    const category = data.categoryIdentifier;

    try {
      if (actionId === 'yes') {
        await api.patch('/api/v1/activity/workout-checkin', { done: true });
        // Navigate to Activities tab and open Add Exercise modal
        setActiveTab('Activities');
        setIsLogModalVisible(true);
      } else if (actionId === 'remind-later') {
        await api.patch('/api/v1/activity/workout-checkin', { remindLater: true });
      } else if (actionId === 'no') {
        await api.patch('/api/v1/activity/workout-checkin', { done: false });
      }
    } catch (error) {
      console.error('Check-in Action Error:', error);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [duration, setDuration] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [isDailyExercise, setIsDailyExercise] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);

  // New Sleep state
  const [showSleepDrawer, setShowSleepDrawer] = useState(false);
  const [bedAngle, setBedAngle] = useState((22.5 / 24) * 360); // 10:30 PM
  const [wakeAngle, setWakeAngle] = useState((7.5 / 24) * 360); // 7:30 AM
  const draggingHandRef = useRef<'bed' | 'wake' | null>(null);
  const bedAngleRef = useRef(bedAngle);
  const wakeAngleRef = useRef(wakeAngle);

  useEffect(() => { bedAngleRef.current = bedAngle; }, [bedAngle]);
  useEffect(() => { wakeAngleRef.current = wakeAngle; }, [wakeAngle]);

  const timeFromAngle = (angle: number) => {
    let hr = (angle / 360) * 24;
    let totalMins = Math.round((hr * 60) / 10) * 10;
    let h = Math.floor(totalMins / 60);
    let m = totalMins % 60;
    if (h >= 24) h -= 24;
    return { h, m, totalMins };
  };

  const formatTime = (h: number, m: number) => {
    const ampm = h >= 12 ? 'pm' : 'am';
    let hr12 = h % 12;
    if (hr12 === 0) hr12 = 12;
    return `${hr12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const bedTimeData = timeFromAngle(bedAngle);
  const wakeTimeData = timeFromAngle(wakeAngle);

  let sleepMins = wakeTimeData.totalMins - bedTimeData.totalMins;
  if (sleepMins < 0) sleepMins += 24 * 60;
  const sleepHrs = Math.floor(sleepMins / 60);
  const sleepM = sleepMins % 60;

  const clockPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const dx = locationX - 150;
        const dy = locationY - 150;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 80 && dist < 160) {
          let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
          if (angle < 0) angle += 360;
          let bAngle = bedAngleRef.current;
          let wAngle = wakeAngleRef.current;
          let distBed = Math.min(Math.abs(angle - bAngle), 360 - Math.abs(angle - bAngle));
          let distWake = Math.min(Math.abs(angle - wAngle), 360 - Math.abs(angle - wAngle));
          draggingHandRef.current = distBed < distWake ? 'bed' : 'wake';
          return true;
        }
        return false;
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const dx = locationX - 150;
        const dy = locationY - 150;
        let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
        if (angle < 0) angle += 360;
        if (draggingHandRef.current === 'bed') {
          setBedAngle(angle);
        } else if (draggingHandRef.current === 'wake') {
          setWakeAngle(angle);
        }
      }
    })
  ).current;

  const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
    let rad = (angle - 90) * Math.PI / 180.0;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const getArcPath = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    let start = polarToCartesian(x, y, radius, startAngle);
    let end = polarToCartesian(x, y, radius, endAngle);
    let diff = endAngle - startAngle;
    if (diff < 0) diff += 360;
    let largeArc = diff > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  // Build the current week days array (Sun–Sat)
  const buildWeekDays = useCallback((weekLogs: any[]) => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });
    const days: WeekDay[] = [];

    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const weekLog = weekLogs.find((l: any) => l.date === dateStr);
      const future = isFuture(d) && !isToday(d);

      days.push({
        date: dateStr,
        label: format(d, 'EEE'),  // Sun, Mon, ...
        dayNum: format(d, 'dd'),
        goalMet: future ? null : (weekLog?.goalMet ?? null),
        hasData: weekLog?.hasData ?? false,
      });
    }
    setWeekDays(days);
  }, []);

  // Fetch week logs for dots
  const fetchWeekLogs = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/dashboard/week');
      if (res.data.success) {
        buildWeekDays(res.data.data.weekLogs);
      }
    } catch (_) { }
  }, [buildWeekDays]);

  // Midnight detection via AppState
  useEffect(() => {
    const checkDateChange = async () => {
      const stored = await AsyncStorage.getItem(DATE_STORAGE_KEY);
      const today = format(new Date(), 'yyyy-MM-dd');
      if (stored && stored !== today) {
        // Date changed — reset to today and refresh
        setSelectedDate(today);
        await fetchDayLog(today);
        fetchWeekLogs();
      }
      await AsyncStorage.setItem(DATE_STORAGE_KEY, today);
    };

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkDateChange();
      }
    });

    // Set initial date
    AsyncStorage.setItem(DATE_STORAGE_KEY, format(new Date(), 'yyyy-MM-dd'));

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    fetchRoutines();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDayLog(selectedDate);
      fetchActivityData(selectedDate);
      fetchProfileImage();
      fetchWeekLogs();
      fetchRoutines();
    }, [selectedDate])
  );

  // Sync steps to backend every 5 minutes
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (currentStepCount > 0) syncSteps();
    }, 5 * 60 * 1000);
    return () => clearInterval(syncInterval);
  }, [currentStepCount]);

  // Final sync when app goes background/inactive
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if ((state === 'background' || state === 'inactive') && currentStepCount > 0) {
        syncSteps();
      }
    });
    return () => sub.remove();
  }, [currentStepCount, activity]);

  // Pedometer-based step detection (uses OS background tracking)
  useEffect(() => {
    let subscription: Pedometer.Subscription | null = null;
    let lastCumulative = 0;

    const startTracking = async () => {
      const perm = await Pedometer.requestPermissionsAsync();
      if (perm.status !== 'granted') return;

      const isAvailable = await Pedometer.isAvailableAsync();
      if (isAvailable) {
        subscription = Pedometer.watchStepCount(result => {
          const delta = result.steps - lastCumulative;
          lastCumulative = result.steps;
          if (delta > 0) {
            setCurrentStepCount(prev => prev + delta);
          }
        });
      }
    };

    startTracking();
    return () => subscription?.remove();
  }, []);



  // Persist total steps for background sync (best-effort)
  useEffect(() => {
    const totalToday = (activity?.steps || 0) + currentStepCount;
    setStepsForBackgroundSync(totalToday).catch(() => { });
  }, [activity?.steps, currentStepCount]);

  const fetchDayLog = async (date: string) => {
    try {
      setLoading(true);
      // Fade out
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(async () => {
        try {
          const response = await api.get(`/api/v1/dashboard/day?date=${date}`);
          if (response.data.success) {
            setLog(response.data.data.log);
          }
        } catch (error: any) {
          console.error('Error fetching day log:', error.response?.data || error.message);
        } finally {
          setLoading(false);
          // Fade in
          Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        }
      });
    } catch (_) {
      setLoading(false);
    }
  };

  const syncSteps = async () => {
    try {
      const newTotal = (activity?.steps || 0) + currentStepCount;
      const response = await api.patch('/api/v1/activity/steps', { 
        steps: newTotal,
        date: selectedDate
      });
      if (response.data.success) {
        setActivity(response.data.data);
        setCurrentStepCount(0);
        fetchDayLog(selectedDate);
      }
    } catch (error) {
      console.error('Error syncing steps:', error);
    }
  };

  const fetchActivityData = async (date: string) => {
    try {
      const response = await api.get(`/api/v1/activity/log?date=${date}`);
      if (response.data.success) {
        setActivity(response.data.data);
      }
    } catch (error: any) {
      console.error('Error fetching activity:', error.response?.data || error.message);
    }
  };

  const fetchRoutines = async () => {
    try {
      const response = await api.get('/api/v1/activity/routine');
      if (response.data.success) {
        setRoutines(response.data.data.exerciseRoutines || []);
        setUserWeight(response.data.data.userWeight || 70);
      }
    } catch (_) { }
  };

  const deleteRoutine = async (id: string) => {
    try {
      const response = await api.delete(`/api/v1/activity/routine/${id}`);
      if (response.data.success) {
        fetchRoutines();
        fetchDayLog(selectedDate);
      }
    } catch (_) { }
  };

  const fetchExerciseLibrary = async () => {
    try {
      const response = await api.get('/api/v1/activity/library');
      if (response.data.success) setExerciseLibrary(response.data.data);
    } catch (_) { }
  };

  const logExercise = async () => {
    if (!selectedExercise || !duration) {
      Alert.alert('Missing info', 'Please select an exercise and enter duration');
      return;
    }
    if (isDailyExercise && selectedDays.length === 0) {
      Alert.alert('Missing info', 'Please select days for your routine');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/api/v1/activity/exercise', {
        exerciseName: selectedExercise.name,
        duration: parseInt(duration),
        sets: sets ? parseInt(sets) : undefined,
        reps: reps ? parseInt(reps) : undefined,
        isDaily: isDailyExercise,
        days: isDailyExercise ? selectedDays : undefined,
        date: selectedDate,
      });
      if (response.data.success) {
        setActivity(response.data.data);
        setIsLogModalVisible(false);
        setSelectedExercise(null);
        setDuration('');
        setSets('');
        setReps('');
        setIsDailyExercise(false);
        setSelectedDays([]);
        setSearchQuery('');
        fetchDayLog(selectedDate);
        fetchRoutines();
      }
    } catch (_) {
      Alert.alert('Error', 'Could not log exercise');
    } finally {
      setLoading(false);
    }
  };

  const saveNewSleep = async () => {
    try {
      setLoading(true);
      const bedtimeStr = `${String(bedTimeData.h).padStart(2, '0')}:${String(bedTimeData.m).padStart(2, '0')}`;
      const wakeTimeStr = `${String(wakeTimeData.h).padStart(2, '0')}:${String(wakeTimeData.m).padStart(2, '0')}`;
      const sleepHours = parseFloat((sleepMins / 60).toFixed(1));

      const response = await api.post('/api/v1/activity/sleep', {
        date: selectedDate,
        bedtime: bedtimeStr,
        wakeTime: wakeTimeStr,
        sleepHours,
      });

      if (response.data.success) {
        setActivity(response.data.data);
        fetchDayLog(selectedDate);
        setShowSleepDrawer(false);
      }
    } catch (_) {
      Alert.alert('Error', 'Could not save sleep');
    } finally {
      setLoading(false);
    }
  };

  const deleteExercise = async (id: string) => {
    try {
      const response = await api.delete(`/api/v1/activity/exercise/${id}`);
      if (response.data.success) {
        setActivity(response.data.data);
        fetchDayLog(selectedDate);
      }
    } catch (_) { }
  };

  const fetchProfileImage = async () => {
    try {
      const response = await api.get('/api/v1/profile');
      if (response.data.success) {
        const prof = response.data.data.profile;
        const usr = response.data.data.user;
        if (prof?.profileImage) setProfileImage(prof.profileImage);
        if (prof?.weightKg) setUserWeight(prof.weightKg);
        if (prof?.heightCm) setUserHeightCm(prof.heightCm);
        const name: string = usr?.fullName || usr?.email || '?';
        const parts = name.trim().split(' ');
        const ini = parts.length >= 2
          ? (parts[0][0] + parts[1][0]).toUpperCase()
          : name.substring(0, 2).toUpperCase();
        setInitials(ini);
      }
    } catch (_) { }
  };

  const incrementWater = async () => {
    if (!log || selectedDate !== todayDate) return; // Only today is editable
    setLog({ ...log, waterGlasses: log.waterGlasses + 1 });
    try {
      await api.patch('/api/v1/dashboard/water', { date: selectedDate });
    } catch (_) {
      setLog({ ...log, waterGlasses: log.waterGlasses });
    }
  };

  const handleDateSelect = (date: string) => {
    if (date === selectedDate) return;
    const future = date > todayDate;
    if (future) return; // ignore future tap
    setSelectedDate(date);
    fetchDayLog(date);
  };

  // ─── UI Components ────────────────────────────────────────────────────────────

  const WaterGlassIcon = ({ filled }: { filled: boolean }) => (
    <Svg width="30" height="38" viewBox="0 0 30 38" fill="none">
      <Path
        d="M5 3L7.5 33C7.6 34.1 8.5 35 9.5 35H20.5C21.5 35 22.4 34.1 22.5 33L25 3H5Z"
        stroke={filled ? '#4facfe' : '#D0D0D0'}
        strokeWidth="2"
        fill={filled ? '#4facfe' : 'transparent'}
        fillOpacity={filled ? 0.25 : 0}
      />
      {filled && (
        <Path
          d="M7.5 20L22.5 20"
          stroke="#4facfe"
          strokeWidth="1.5"
          opacity="0.5"
        />
      )}
    </Svg>
  );

  // Segmented donut — 3 arcs for fat, protein, carbs
  const SegmentedDonut = ({
    consumed, calorieGoal,
    fatConsumed, fatGoal,
    proteinConsumed, proteinGoal,
    carbsConsumed, carbsGoal,
    size = 180, strokeWidth = 18
  }: {
    consumed: number; calorieGoal: number;
    fatConsumed: number; fatGoal: number;
    proteinConsumed: number; proteinGoal: number;
    carbsConsumed: number; carbsGoal: number;
    size?: number; strokeWidth?: number;
  }) => {
    const radius = (size - strokeWidth) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const circumference = 2 * Math.PI * radius;

    const total = fatConsumed + proteinConsumed + carbsConsumed;
    const gap = total > 0 ? 0.015 * circumference : 0; // tiny gap between segments

    const fatFrac = total > 0 ? fatConsumed / total : 0;
    const proFrac = total > 0 ? proteinConsumed / total : 0;
    const carbFrac = total > 0 ? carbsConsumed / total : 0;

    // Each segment's arc length (minus gap)
    const fatArc = fatFrac * circumference - gap;
    const proArc = proFrac * circumference - gap;
    const carbArc = carbFrac * circumference - gap;

    // Offsets (start positions) — we go Fat → Protein → Carbs
    const fatOffset = circumference - 0; // starts at top
    const proOffset = circumference - fatFrac * circumference - gap;
    const carbOffset = circumference - (fatFrac + proFrac) * circumference - gap * 2;

    const emptyBg = total === 0;

    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          {/* Background ring */}
          <Circle
            stroke="#EDE8E0"
            fill="none"
            cx={cx} cy={cy} r={radius}
            strokeWidth={strokeWidth}
          />
          {!emptyBg && (
            <G rotation="-90" origin={`${cx}, ${cy}`}>
              {/* Fat - blue */}
              {fatArc > 0 && (
                <Circle
                  stroke="#6CB4F5"
                  fill="none"
                  cx={cx} cy={cy} r={radius}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${fatArc} ${circumference - fatArc}`}
                  strokeDashoffset={-0}
                  strokeLinecap="butt"
                />
              )}
              {/* Protein - yellow */}
              {proArc > 0 && (
                <Circle
                  stroke="#F5C842"
                  fill="none"
                  cx={cx} cy={cy} r={radius}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${proArc} ${circumference - proArc}`}
                  strokeDashoffset={-fatFrac * circumference}
                  strokeLinecap="butt"
                />
              )}
              {/* Carbs - green */}
              {carbArc > 0 && (
                <Circle
                  stroke="#5BCA8A"
                  fill="none"
                  cx={cx} cy={cy} r={radius}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${carbArc} ${circumference - carbArc}`}
                  strokeDashoffset={-(fatFrac + proFrac) * circumference}
                  strokeLinecap="butt"
                />
              )}
            </G>
          )}
        </Svg>
        {/* Center text */}
        <View style={styles.donutCenter}>
          <Text style={styles.donutLabel}>Consumed</Text>
          <Text style={styles.donutVal}>{consumed}</Text>
          <Text style={styles.donutUnit}>KCal</Text>
        </View>
      </View>
    );
  };

  if (loading && !log) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF8C00" />
      </View>
    );
  }

  const isViewingToday = selectedDate === todayDate;
  const effectiveGoal = log?.calorieGoal || goals.calorieGoal;
  const remaining = Math.max(0, effectiveGoal - (log?.caloriesConsumed || 0));
  const consumed = log?.caloriesConsumed || 0;
  const consumedPercent = effectiveGoal > 0 ? consumed / effectiveGoal : 0;
  const isAfter2PM = new Date().getHours() >= 14;

  const waterGoal = log?.waterGoal || goals.waterGlasses;
  const stepGoal = log?.stepGoal || goals.stepGoal;
  const stepLengthMeters = (userHeightCm * 0.415) / 100;

  const proPct = Math.min(((log?.proteinConsumed || 0) / (log?.proteinGoal || goals.proteinGoal)) * 100, 100) || 0;
  const fatPct = Math.min(((log?.fatConsumed || 0) / (log?.fatGoal || goals.fatGoal)) * 100, 100) || 0;
  const carbPct = Math.min(((log?.carbsConsumed || 0) / (log?.carbsGoal || goals.carbsGoal)) * 100, 100) || 0;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* TOP BAR */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.avatarPlaceholder} onPress={() => router.push('/(tabs)/(dashboard)/profile')}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleBtn, activeTab === 'Meals' && styles.toggleBtnActive]}
              onPress={() => setActiveTab('Meals')}
            >
              <Text style={[styles.toggleText, activeTab === 'Meals' && styles.toggleTextActive]}>Meals</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, activeTab === 'Activities' && styles.toggleBtnActive]}
              onPress={() => setActiveTab('Activities')}
            >
              <Text style={[styles.toggleText, activeTab === 'Activities' && styles.toggleTextActive]}>Activities</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.bellIcon} onPress={() => router.push('/(tabs)/notification')}>
            <Text style={{ fontSize: 20 }}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* WEEK CALENDAR */}
        <View style={styles.calendarRow}>
          {weekDays.map((day) => {
            const isSelected = day.date === selectedDate;
            const future = day.date > todayDate;

            return (
              <TouchableOpacity
                key={day.date}
                onPress={() => handleDateSelect(day.date)}
                style={[styles.dayCard, isSelected && styles.dayCardActive]}
                disabled={future}
              >
                <Text style={[styles.dayLetter, isSelected && styles.dayLetterActive, future && styles.dayLetterFuture]}>
                  {day.label}
                </Text>
                <Text style={[styles.dayNumber, isSelected && styles.dayNumberActive, future && styles.dayNumberFuture]}>
                  {day.dayNum}
                </Text>
                {/* Goal dot */}
                {!future && (
                  <View style={[
                    styles.goalDot,
                    day.goalMet === true ? styles.goalDotMet :
                      day.goalMet === false && day.hasData ? styles.goalDotMissed :
                        { backgroundColor: 'transparent' }
                  ]} />
                )}
                {future && <View style={styles.goalDotEmpty} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* "Viewing past date" label */}
        {!isViewingToday && (
          <View style={styles.viewingLabelRow}>
            <Text style={styles.viewingLabel}>
              Viewing: {format(parseISO(selectedDate), 'EEE dd MMM')}
            </Text>
            <TouchableOpacity onPress={() => { setSelectedDate(todayDate); fetchDayLog(todayDate); }}>
              <Text style={styles.backToTodayBtn}>Back to today</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ANIMATED CARDS */}
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* CALORIE CARD */}
          {activeTab === 'Meals' && (
            <View style={styles.card}>
              {/* Goal header row */}
              <View style={styles.goalHeader}>
                <View style={styles.goalHeaderLeft}>
                  <Text style={styles.goalHeaderIcon}>⚡</Text>
                  <View>
                    <Text style={styles.goalHeaderTitle}>Calorie Goal: {effectiveGoal}kcal</Text>
                    <Text style={styles.goalHeaderSub}>
                      Remaining only <Text style={styles.remainingBold}>{remaining}</Text> KCal
                    </Text>
                  </View>
                </View>
              </View>

              {/* Donut + Macros row */}
              <View style={styles.calorieRow}>
                {/* Segmented Donut */}
                <SegmentedDonut
                  consumed={consumed}
                  calorieGoal={effectiveGoal}
                  fatConsumed={log?.fatConsumed || 0}
                  fatGoal={log?.fatGoal || goals.fatGoal}
                  proteinConsumed={log?.proteinConsumed || 0}
                  proteinGoal={log?.proteinGoal || goals.proteinGoal}
                  carbsConsumed={log?.carbsConsumed || 0}
                  carbsGoal={log?.carbsGoal || goals.carbsGoal}
                />

                {/* Right: Macro list */}
                <View style={styles.macroList}>
                  {/* Fat */}
                  <View style={styles.macroItem}>
                    <Text style={styles.macroEmoji}>🫐</Text>
                    <View style={styles.macroDetails}>
                      <Text style={styles.macroName}>Fat</Text>
                      <View style={[styles.macroBar, { backgroundColor: '#F0F0F0' }]}>
                        <View style={[styles.macroBarFill, { width: `${fatPct}%`, backgroundColor: '#6CB4F5' }]} />
                      </View>
                      <Text style={styles.macroGrams}>{log?.fatConsumed || 0}g / {log?.fatGoal || goals.fatGoal}g</Text>
                    </View>
                  </View>
                  {/* Protein */}
                  <View style={styles.macroItem}>
                    <Text style={styles.macroEmoji}>🌿</Text>
                    <View style={styles.macroDetails}>
                      <Text style={styles.macroName}>Protein</Text>
                      <View style={[styles.macroBar, { backgroundColor: '#F0F0F0' }]}>
                        <View style={[styles.macroBarFill, { width: `${proPct}%`, backgroundColor: '#F5C842' }]} />
                      </View>
                      <Text style={styles.macroGrams}>{log?.proteinConsumed || 0}g / {log?.proteinGoal || goals.proteinGoal}g</Text>
                    </View>
                  </View>
                  {/* Carbs */}
                  <View style={styles.macroItem}>
                    <Text style={styles.macroEmoji}>🌾</Text>
                    <View style={styles.macroDetails}>
                      <Text style={styles.macroName}>Carbs</Text>
                      <View style={[styles.macroBar, { backgroundColor: '#F0F0F0' }]}>
                        <View style={[styles.macroBarFill, { width: `${carbPct}%`, backgroundColor: '#5BCA8A' }]} />
                      </View>
                      <Text style={styles.macroGrams}>{log?.carbsConsumed || 0}g / {log?.carbsGoal || goals.carbsGoal}g</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Motivational row */}
              <View style={styles.motivationalRow}>
                {consumedPercent >= 0.8 ? (
                  <Text style={styles.motivationalText}>✨ You are doing great!</Text>
                ) : isAfter2PM && isViewingToday && consumedPercent < 0.4 ? (
                  <Text style={[styles.motivationalText, { color: '#E05252' }]}>⚠️ You're behind today!</Text>
                ) : (
                  <Text style={styles.motivationalText}>🔥 Keep going!</Text>
                )}
                <TouchableOpacity>
                  <Text style={styles.checkPointsText}>🏆 Check your points ➔</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* WATER TRACKER CARD */}
          {activeTab === 'Meals' && (
            <View style={styles.card}>
              <View style={styles.waterHeaderRow}>
                <View style={styles.waterHeaderLeft}>
                  <Text style={styles.waterDropIcon}>💧</Text>
                  <View>
                    <Text style={styles.cardTitle}>Water Intake</Text>
                    <Text style={styles.waterSubtitleSmall}>Stay hydrated—drink more water!</Text>
                  </View>
                </View>
              </View>

              <View style={styles.glassesRow}>
                {[...Array(waterGoal)].map((_, i) => (
                  <View key={i} style={styles.glassWrapper}>
                    <WaterGlassIcon filled={i < (log?.waterGlasses || 0)} />
                  </View>
                ))}
                {isViewingToday && (
                  <TouchableOpacity onPress={incrementWater} style={styles.addGlassBtn}>
                    <Text style={styles.addGlassBtnText}>+</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.waterCountText}>
                Today you drink only <Text style={styles.waterCountBold}>{log?.waterGlasses || 0}</Text> glass{(log?.waterGlasses || 0) !== 1 ? 'es' : ''} of water.
              </Text>
            </View>
          )}

          {/* --- ACTIVITIES TAB CONTENT --- */}
          {activeTab === 'Activities' && activity && (
            <View>
              {/* STEPS CARD */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Steps Tracking</Text>
                <View style={styles.activityMainRow}>
                  <View style={styles.ringContainer}>
                    <Svg width={140} height={140}>
                      <Circle cx="70" cy="70" r="55" stroke="#F0E6D2" strokeWidth="10" fill="none" />
                      <Circle cx="70" cy="70" r="55" stroke="#FF8C00" strokeWidth="10" strokeDasharray={`${2 * Math.PI * 55}`} strokeDashoffset={`${2 * Math.PI * 55 * (1 - Math.min((activity.steps + currentStepCount) / (stepGoal || 1), 1))}`} strokeLinecap="round" fill="none" transform="rotate(-90 70 70)" />
                    </Svg>
                    <View style={styles.ringCenterText}>
                      <Text style={styles.ringStepsVal}>{activity.steps + currentStepCount}</Text>
                      <Text style={styles.ringStepsLabel}>/ {(stepGoal || 0).toLocaleString()}</Text>
                    </View>
                  </View>
                  <View style={styles.stepStats}>
                    <View style={styles.stepStatItem}>
                      <Text style={styles.stepStatLabel}>Distance</Text>
                      <Text style={styles.stepStatVal}>{(((activity.steps + currentStepCount) * stepLengthMeters) / 1000).toFixed(2)} km</Text>
                    </View>
                    <View style={styles.stepStatItem}>
                      <Text style={styles.stepStatLabel}>Burned</Text>
                      <Text style={styles.stepStatVal}>{Math.round((activity.steps + currentStepCount) * 0.04)} kcal</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* TOTAL CALORIES BURNT SUMMARY CARD */}
              <View style={styles.card}>
                {(() => {
                  const liveStepCalories = Math.round((activity.steps + currentStepCount) * 0.04);
                  const exerciseCalories = activity.exercises?.reduce((sum: number, ex: any) => sum + (ex.caloriesBurnt || 0), 0) || 0;
                  const burnt = liveStepCalories + exerciseCalories;
                  const goal = goals.caloriesBurntGoal || 1;
                  const progress = Math.min(100, Math.round((burnt / goal) * 100));

                  let message = "Keep moving! You can do it 💪";
                  if (progress >= 100) message = "Goal crushed! Amazing work 🏆";
                  else if (progress >= 80) message = "Almost there! Push a little more ⚡";
                  else if (progress >= 40) message = "Great progress! Keep going 🔥";

                  return (
                    <View>
                      <View style={[styles.rowCentered, { marginBottom: 10 }]}>
                        <Text style={{ fontSize: 24, marginRight: 8 }}>🔥</Text>
                        <Text style={styles.cardTitle}>Total Burnt Today</Text>
                        <View style={{ flex: 1 }} />
                        <Text style={[styles.cardTitle, { color: '#FF8C00' }]}>{burnt} kcal</Text>
                      </View>

                      <View style={{ marginTop: 5 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text style={{ color: '#888', fontSize: 13 }}>{burnt} / {goal} kcal goal</Text>
                          <Text style={{ color: '#FF8C00', fontSize: 13, fontWeight: 'bold' }}>{progress}%</Text>
                        </View>
                        <View style={styles.progressBarBG}>
                          <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: '#FF8C00' }]} />
                        </View>
                        <Text style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: '#FF8C00', fontWeight: '500' }}>
                          {message}
                        </Text>
                      </View>

                      <View style={{ marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderColor: '#eee' }}>
                        <Text style={{ color: '#555', fontSize: 13, marginBottom: 8 }}>Breakdown:</Text>
                        <View style={[styles.rowCentered, { justifyContent: 'space-between', marginBottom: 5 }]}>
                          <Text style={{ color: '#888' }}>Steps</Text>
                          <Text style={{ fontWeight: '500' }}>{liveStepCalories} kcal</Text>
                        </View>
                        {activity.exercises?.map((ex: any, i: number) => (
                          <View key={i} style={[styles.rowCentered, { justifyContent: 'space-between', marginBottom: 5 }]}>
                            <Text style={{ color: '#888' }}>{ex.name}</Text>
                            <Text style={{ fontWeight: '500' }}>{ex.caloriesBurnt || 0} kcal</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })()}
              </View>

              {/* SLEEP CARD MINIMAL */}
              <View style={[styles.card, { backgroundColor: '#1C1C1E', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 }]} >
                {/* Left side */}
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                      <Text style={{ fontSize: 18 }}>🛏️</Text>
                    </View>
                    <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold' }}>Sleep</Text>
                  </View>
                  {isTodaySelected && (
                    <TouchableOpacity onPress={() => setShowSleepDrawer(true)} style={{ backgroundColor: '#FF6B00', paddingVertical: 8, paddingHorizontal: 24, borderRadius: 20, alignSelf: 'flex-start' }}>
                      <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Enter</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Right side - Progress bar */}
                <View style={{ alignItems: 'center', width: 120 }}>
                  <View style={{ backgroundColor: '#483D8B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 8, position: 'relative' }}>
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>
                      {activity.sleepHours !== undefined ? `${activity.sleepHours}h` : '0h'}
                    </Text>
                    {/* Tooltip triangle */}
                    <View style={{ position: 'absolute', bottom: -5, left: '50%', marginLeft: -5, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#483D8B' }} />
                  </View>
                  <View style={{ width: '100%', height: 10, backgroundColor: '#444', borderRadius: 5, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.min(100, ((activity.sleepHours || 0) / 8) * 100)}%`, height: '100%', backgroundColor: '#6495ED' }} />
                  </View>
                </View>
              </View>

              {/* EXERCISE CARD */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>My Exercises</Text>
                  {isTodaySelected && (
                    <TouchableOpacity style={styles.logBtnSmall} onPress={() => { setIsLogModalVisible(true); fetchExerciseLibrary(); }}>
                      <Text style={styles.logBtnSmallText}>＋ Add</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {activity.exercises.length === 0 ? (
                  <View style={styles.emptyActivity}>
                    <Text style={styles.emptyActivityText}>{isTodaySelected ? 'No exercises logged yet.' : 'No activity recorded for this day'}</Text>
                  </View>
                ) : (
                  activity.exercises.map((ex) => (
                    <View key={ex._id} style={styles.exerciseCard}>
                      <View style={styles.exerciseIcon}><Text style={{ fontSize: 20 }}>🏃</Text></View>
                      <View style={styles.exerciseInfo}>
                        <View style={styles.rowCentered}>
                          <Text style={styles.exerciseName}>{ex.name}</Text>
                          {(ex.isRoutine || ex.fromRoutine) && <Text style={[styles.routineBadge, { color: '#666', marginLeft: 6 }]}>🔄</Text>}
                        </View>
                        <Text style={styles.exerciseMeta}>{ex.duration} min {ex.sets ? `• ${ex.sets} sets` : ''} • {ex.caloriesBurnt} kcal</Text>
                      </View>
                      {isTodaySelected && (
                        <TouchableOpacity onPress={() => deleteExercise(ex._id)} style={{ padding: 10 }}>
                          <Text style={{ fontSize: 20 }}>🗑️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </View>

              {/* MY ROUTINE CARD */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Daily Routine</Text>
                {routines.length > 0 ? (
                  <>
                    {routines.map((r) => {
                      const kcal = Math.round(r.met * userWeight * (r.duration / 60));
                      return (
                        <View key={r._id} style={styles.routineItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.routineName}>{r.exerciseName}</Text>
                            <View style={styles.rowCentered}>
                              <Text style={styles.routineDays}>{r.days.join(', ').toUpperCase()}</Text>
                              <Text style={[styles.routineMeta, { marginLeft: 10 }]}>{r.duration} min {r.sets ? `• ${r.sets} sets` : ''}</Text>
                            </View>
                            <Text style={{ color: '#FF6B00', fontSize: 11, marginTop: 4, fontWeight: '600' }}>+{kcal} kcal burn</Text>
                          </View>
                          {isTodaySelected && (
                            <TouchableOpacity onPress={() => deleteRoutine(r._id)} style={{ padding: 10 }}>
                              <Text style={{ fontSize: 20 }}>🗑️</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                    <View style={{ marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderColor: '#FAFAFA' }}>
                      <Text style={{ color: '#555', fontSize: 13, fontWeight: '700', textAlign: 'right' }}>
                        Total routine burn: {routines.reduce((sum, r) => sum + Math.round(r.met * userWeight * (r.duration / 60)), 0)} kcal/day
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.emptyRoutinesText}>Add recurring exercises to see them here.</Text>
                )}
              </View>

              <View style={{ height: 60 }} />
            </View>
          )}

        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* LOG EXERCISE MODAL */}
      <Modal visible={isLogModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsLogModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: 40 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>+ Add Exercise</Text>
              <TouchableOpacity onPress={() => setIsLogModalVisible(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            {!selectedExercise && (
              <>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search exercise (Running, Push ups...)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                <Text style={styles.inputLabel}>Presets</Text>
                <ScrollView style={styles.exerciseList} showsVerticalScrollIndicator={false}>
                  {exerciseLibrary.filter(ex => ex.name.toLowerCase().includes(searchQuery.toLowerCase())).map((ex, i) => (
                    <TouchableOpacity key={i} style={styles.libraryItem} onPress={() => setSelectedExercise(ex)}>
                      <View style={styles.libraryItemIcon}><Text>{ex.category === 'cardio' ? '🏃‍♂️' : ex.category === 'flexibility' ? '🧘' : '💪'}</Text></View>
                      <View>
                        <Text style={styles.libraryItemName}>{ex.name}</Text>
                        <Text style={styles.libraryItemCategory}>{ex.category}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {exerciseLibrary.length === 0 && [
                    { name: 'Weight Lifting (Heavy)', met: 6.0, category: 'strength' },
                    { name: 'HIIT Workout', met: 8.0, category: 'cardio' },
                    { name: 'Yoga (Hatha)', met: 3.0, category: 'flexibility' },
                    { name: 'Push ups', met: 3.8, category: 'strength' },
                    { name: 'Sit ups', met: 3.8, category: 'strength' },
                    { name: 'Plank', met: 3.0, category: 'strength' },
                    { name: 'Swimming (Freestyle)', met: 8.0, category: 'cardio' },
                    { name: 'Pilates', met: 3.0, category: 'flexibility' },
                    { name: 'Stretching', met: 2.3, category: 'flexibility' },
                    { name: 'Running (Moderate)', met: 9.8, category: 'cardio' },
                    { name: 'Running (Fast)', met: 11.5, category: 'cardio' },
                    { name: 'Cycling (Moderate)', met: 7.5, category: 'cardio' },
                    { name: 'Cycling (Fast)', met: 10.0, category: 'cardio' },
                    { name: 'Walking (Brisk)', met: 4.3, category: 'cardio' },
                  ].filter(ex => ex.name.toLowerCase().includes(searchQuery.toLowerCase())).map((ex, i) => (
                    <TouchableOpacity key={`fallback-${i}`} style={styles.libraryItem} onPress={() => setSelectedExercise(ex)}>
                      <View style={styles.libraryItemIcon}><Text>{ex.category === 'cardio' ? '🏃‍♂️' : ex.category === 'flexibility' ? '🧘' : '💪'}</Text></View>
                      <View>
                        <Text style={styles.libraryItemName}>{ex.name}</Text>
                        <Text style={styles.libraryItemCategory}>{ex.category}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {selectedExercise && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <TouchableOpacity onPress={() => setSelectedExercise(null)} style={styles.selectedExerciseBadge}>
                  <Text style={styles.selectedExerciseText}>{selectedExercise.name} ✕</Text>
                </TouchableOpacity>

                <View style={styles.stepperRow}>
                  <Text style={styles.inputLabel}>Duration (min)</Text>
                  <View style={styles.stepperBox}>
                    <TouchableOpacity onPress={() => setDuration(String(Math.max(0, Number(duration || 0) - 10)))} style={styles.stepperBtn}><Text style={styles.stepperBtnText}>-</Text></TouchableOpacity>
                    <Text style={styles.stepperVal}>{duration || '0'}</Text>
                    <TouchableOpacity onPress={() => setDuration(String(Number(duration || 0) + 10))} style={styles.stepperBtn}><Text style={styles.stepperBtnText}>+</Text></TouchableOpacity>
                  </View>
                </View>

                {['cardio'].indexOf(selectedExercise.category) === -1 && (
                  <View style={[styles.rowCentered, { marginBottom: 20 }]}>
                    <View style={[styles.stepperRow, { flex: 1, marginRight: 15, flexDirection: 'column', alignItems: 'flex-start', marginBottom: 0 }]}>
                      <Text style={[styles.inputLabel, { marginBottom: 5 }]}>Sets</Text>
                      <View style={[styles.stepperBox, { width: '100%', justifyContent: 'space-between' }]}>
                        <TouchableOpacity onPress={() => setSets(String(Math.max(0, Number(sets || 0) - 1)))} style={styles.stepperBtn}><Text style={styles.stepperBtnText}>-</Text></TouchableOpacity>
                        <Text style={styles.stepperVal}>{sets || '0'}</Text>
                        <TouchableOpacity onPress={() => setSets(String(Number(sets || 0) + 1))} style={styles.stepperBtn}><Text style={styles.stepperBtnText}>+</Text></TouchableOpacity>
                      </View>
                    </View>
                    <View style={[styles.stepperRow, { flex: 1, flexDirection: 'column', alignItems: 'flex-start', marginBottom: 0 }]}>
                      <Text style={[styles.inputLabel, { marginBottom: 5 }]}>Reps</Text>
                      <View style={[styles.stepperBox, { width: '100%', justifyContent: 'space-between' }]}>
                        <TouchableOpacity onPress={() => setReps(String(Math.max(0, Number(reps || 0) - 1)))} style={styles.stepperBtn}><Text style={styles.stepperBtnText}>-</Text></TouchableOpacity>
                        <Text style={styles.stepperVal}>{reps || '0'}</Text>
                        <TouchableOpacity onPress={() => setReps(String(Number(reps || 0) + 1))} style={styles.stepperBtn}><Text style={styles.stepperBtnText}>+</Text></TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.caloriePreview}>
                  <Text style={{ color: '#888', marginBottom: 5 }}>Calories Burnt</Text>
                  <Text style={styles.caloriePreviewText}>
                    ≈ {Math.round(selectedExercise.met * userWeight * (Number(duration) / 60) || 0)} kcal
                  </Text>
                </View>

                <View style={[styles.toggleRow, { backgroundColor: '#F9F9F9', padding: 15, borderRadius: 16 }]}>
                  <Text style={styles.toggleLabel}>Track: <Text style={{ fontWeight: 'bold', color: '#FF8C00' }}>{isDailyExercise ? 'Daily' : 'Today'}</Text></Text>
                  <TouchableOpacity
                    onPress={() => setIsDailyExercise(!isDailyExercise)}
                    style={[styles.customToggle, isDailyExercise && styles.customToggleActive, { width: 60, height: 32, borderRadius: 16 }]}
                  >
                    <View style={[styles.customToggleCircle, isDailyExercise && styles.customToggleCircleActive, { width: 28, height: 28, borderRadius: 14 }]} />
                  </TouchableOpacity>
                </View>

                {isDailyExercise && (
                  <View style={styles.daySelector}>
                    {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => (
                      <TouchableOpacity
                        key={day}
                        onPress={() => {
                          setSelectedDays(prev =>
                            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                          );
                        }}
                        style={[styles.dayChip, selectedDays.includes(day) && styles.dayChipActive]}
                      >
                        <Text style={[styles.dayChipText, selectedDays.includes(day) && styles.dayChipTextActive]}>
                          {day.substring(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <View style={{ flexDirection: 'row', marginTop: 20 }}>
                  <TouchableOpacity
                    style={[styles.saveExerciseBtn, { flex: 1, backgroundColor: '#eee', marginRight: 10, shadowOpacity: 0 }]}
                    onPress={() => setIsLogModalVisible(false)}
                  >
                    <Text style={[styles.saveExerciseBtnText, { color: '#555' }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveExerciseBtn, { flex: 2 }, (!duration || Number(duration) === 0) && { opacity: 0.5 }]}
                    onPress={logExercise}
                    disabled={!duration || Number(duration) === 0}
                  >
                    <Text style={styles.saveExerciseBtnText}>Log Exercise</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* SLEEP DRAWER MODAL */}
      <Modal visible={showSleepDrawer} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#1C1C1E', height: '80%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20 }}>
            {/* Pill */}
            <View style={{ width: 60, height: 6, backgroundColor: '#444', borderRadius: 3, alignSelf: 'center', marginBottom: 20 }} />
            <View style={{ backgroundColor: '#333', alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 6, borderRadius: 20, marginBottom: 30 }}>
              <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Today</Text>
            </View>

            {/* CLOCK DIAL */}
            <View style={{ alignSelf: 'center', width: 300, height: 300 }} {...clockPanResponder.panHandlers}>
              <Svg width="300" height="300">
                {/* Background Ring */}
                <Circle cx="150" cy="150" r="120" stroke="#333" strokeWidth="30" fill="none" />

                {/* Orange Arc */}
                <Path d={getArcPath(150, 150, 120, bedAngle, wakeAngle)} stroke="#FF6B00" strokeWidth="30" fill="none" strokeLinecap="round" />

                {/* Ticks & Numbers */}
                {[0, 6, 12, 18].map(h => {
                  let a = (h / 24) * 360;
                  // Inner ticks
                  let tPos = polarToCartesian(150, 150, 95, a);
                  let lPos = polarToCartesian(150, 150, 75, a);
                  return (
                    <G key={h}>
                      <Circle cx={tPos.x} cy={tPos.y} r="2" fill="#888" />
                      <SvgText x={lPos.x} y={lPos.y + 4} fill="#888" fontSize="12" fontWeight="bold" textAnchor="middle">{h}</SvgText>
                    </G>
                  );
                })}

                {/* Handles */}
                {(() => {
                  const bPos = polarToCartesian(150, 150, 120, bedAngle);
                  const wPos = polarToCartesian(150, 150, 120, wakeAngle);
                  return (
                    <>
                      <Circle cx={bPos.x} cy={bPos.y} r="18" fill="#FFF" />
                      <SvgText x={bPos.x} y={bPos.y + 5} fontSize="16" textAnchor="middle">🛏️</SvgText>

                      <Circle cx={wPos.x} cy={wPos.y} r="18" fill="#FFF" />
                      <SvgText x={wPos.x} y={wPos.y + 5} fontSize="16" textAnchor="middle">⏰</SvgText>
                    </>
                  );
                })()}
              </Svg>

              {/* Center Text */}
              <View style={{ position: 'absolute', top: 0, left: 0, width: 300, height: 300, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 5 }}>🛏️ {formatTime(bedTimeData.h, bedTimeData.m)}</Text>
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>⏰ {formatTime(wakeTimeData.h, wakeTimeData.m)}</Text>
              </View>
            </View>

            {/* Total Sleep Time */}
            <View style={{ alignItems: 'center', marginTop: 30 }}>
              <Text style={{ color: '#FF6B00', fontSize: 18, fontWeight: '600' }}>
                Sleep time: {sleepHrs} hours {sleepM} minutes
              </Text>
            </View>

            {/* Bottom Buttons */}
            <View style={{ flexDirection: 'row', marginTop: 'auto', marginBottom: 20 }}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: '#333', padding: 18, borderRadius: 16, alignItems: 'center', marginRight: 10 }} onPress={() => setShowSleepDrawer(false)}>
                <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, backgroundColor: '#FF6B00', padding: 18, borderRadius: 16, alignItems: 'center' }} onPress={saveNewSleep}>
                <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },
  scrollContent: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 20 },

  // TOP BAR
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#EAE1D3', borderRadius: 20, padding: 4 },
  toggleBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16 },
  toggleBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#888' },
  toggleTextActive: { color: '#333' },
  bellIcon: {
    padding: 8,
    backgroundColor: '#FFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    position: 'relative',
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF8C00',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#F5F0E8',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // CALENDAR
  calendarRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dayCard: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, borderRadius: 20, minWidth: 40 },
  dayCardActive: { backgroundColor: '#FF8C00' },
  dayLetter: { fontSize: 11, color: '#888', marginBottom: 4, fontWeight: '600' },
  dayLetterActive: { color: '#FFE8CC' },
  dayLetterFuture: { color: '#CCC' },
  dayNumber: { fontSize: 17, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  dayNumberActive: { color: '#fff' },
  dayNumberFuture: { color: '#CCC' },
  goalDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  goalDotMet: { backgroundColor: '#FF8C00' },
  goalDotMissed: { backgroundColor: '#888' },
  goalDotEmpty: { width: 6, height: 6 },

  // VIEWING LABEL
  viewingLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 4 },
  viewingLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
  backToTodayBtn: { fontSize: 13, color: '#FF8C00', fontWeight: 'bold' },

  // SHARED CARDS
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 },

  // GOAL HEADER
  goalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  goalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goalHeaderIcon: { fontSize: 24 },
  goalHeaderTitle: { fontSize: 17, fontWeight: 'bold', color: '#222' },
  goalHeaderSub: { fontSize: 13, color: '#888', marginTop: 2 },
  remainingBold: { color: '#FF8C00', fontWeight: 'bold' },

  // CALORIE CARD
  calorieRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  donutCenter: { alignItems: 'center' },
  donutLabel: { fontSize: 11, color: '#888' },
  donutVal: { fontSize: 26, fontWeight: 'bold', color: '#333' },
  donutUnit: { fontSize: 12, color: '#888' },

  // MACRO LIST (right side)
  macroList: { flex: 1, marginLeft: 16, gap: 12 },
  macroItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  macroEmoji: { fontSize: 18, width: 26 },
  macroDetails: { flex: 1 },
  macroName: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 4 },
  macroBar: { height: 8, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden', marginBottom: 2 },
  macroBarFill: { height: '100%', borderRadius: 4 },
  macroGrams: { fontSize: 11, color: '#888' },

  // MOTIVATIONAL ROW
  motivationalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF8F0', padding: 12, borderRadius: 12, marginTop: 4 },
  motivationalText: { fontSize: 13, fontWeight: '600', color: '#FF8C00' },
  checkPointsText: { fontSize: 12, fontWeight: 'bold', color: '#333' },

  // WATER TRACKER
  waterHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  waterHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  waterDropIcon: { fontSize: 28 },
  waterSubtitleSmall: { fontSize: 12, color: '#888', marginTop: 2 },
  glassesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 },
  glassWrapper: { alignItems: 'center' },
  addGlassBtn: { width: 34, height: 38, borderRadius: 10, backgroundColor: '#F0E6D2', justifyContent: 'center', alignItems: 'center' },
  addGlassBtnText: { fontSize: 20, color: '#888', fontWeight: 'bold' },
  waterCountText: { fontSize: 14, color: '#555', marginTop: 4 },
  waterCountBold: { color: '#FF8C00', fontWeight: 'bold', fontSize: 16 },

  // ACTIVITIES TAB
  activityMainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  ringContainer: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  ringCenterText: { position: 'absolute', alignItems: 'center' },
  ringStepsVal: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  ringStepsLabel: { fontSize: 12, color: '#888' },
  stepStats: { flex: 1, marginLeft: 30 },
  stepStatItem: { marginBottom: 15 },
  stepStatLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  stepStatVal: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  macrosContainer: { flex: 1, marginLeft: 0 },
  macroRow: { marginBottom: 12 },
  macroLabel: { fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 4 },
  progressBarBG: { height: 8, backgroundColor: '#F0E6D2', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  totalBurntContainer: { width: 100, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  totalBurntVal: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  totalBurntLabel: { fontSize: 12, color: '#888', textAlign: 'center' },
  exerciseSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 10 },
  addExerciseLink: { paddingVertical: 4 },
  addExerciseLinkText: { color: '#FF8C00', fontWeight: 'bold', fontSize: 14 },
  exerciseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 2 },
  exerciseIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF8F0', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  exerciseMeta: { fontSize: 13, color: '#888' },
  emptyExercises: { alignItems: 'center', padding: 30 },
  emptyExercisesText: { color: '#AAA', fontSize: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 40 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 12, alignItems: 'center', marginHorizontal: 4, shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 2 },
  summaryLabel: { fontSize: 10, color: '#888', marginBottom: 4, textTransform: 'uppercase' },
  summaryVal: { fontSize: 14, fontWeight: 'bold', color: '#333' },

  // MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#F5F0E8', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, minHeight: '60%', maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  closeModalText: { fontSize: 24, color: '#888', padding: 5 },
  searchInput: { backgroundColor: '#fff', borderRadius: 12, padding: 12, fontSize: 16, marginBottom: 15 },
  exerciseList: { maxHeight: 300 },
  libraryItem: { padding: 15, backgroundColor: '#fff', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  libraryItemActive: { borderColor: '#FF8C00', backgroundColor: '#FFF8F0' },
  libraryItemName: { fontSize: 15, fontWeight: '600', color: '#333' },
  libraryItemNameActive: { color: '#FF8C00' },
  libraryItemCategory: { fontSize: 12, color: '#888', marginTop: 2, textTransform: 'capitalize' },
  durationInputContainer: { marginTop: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8 },
  durationInput: { backgroundColor: '#fff', borderRadius: 12, padding: 12, fontSize: 18, fontWeight: 'bold', color: '#333' },
  saveExerciseBtn: { backgroundColor: '#FF8C00', borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 30, shadowColor: '#FF8C00', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveExerciseBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // NEW STYLES
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  rowCentered: { flexDirection: 'row', alignItems: 'center' },
  logBtnSmall: { backgroundColor: '#FF8C00', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12 },
  logBtnSmallText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  sleepMainRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  sleepTimeLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  sleepTimeVal: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  sleepProgressContainer: { marginTop: 10 },
  sleepProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  sleepProgressText: { fontSize: 14, color: '#555' },
  emptyActivity: { alignItems: 'center', paddingVertical: 20 },
  emptyActivityText: { color: '#AAA', fontSize: 14 },
  routineBadge: { fontSize: 12, marginLeft: 6 },
  routineItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  routineName: { fontSize: 15, fontWeight: '600', color: '#333' },
  routineDays: { fontSize: 10, color: '#FF8C00', fontWeight: 'bold', marginTop: 2 },
  routineMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  emptyRoutinesText: { color: '#AAA', fontSize: 13, textAlign: 'center', marginTop: 10 },
  libraryItemIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  selectedExerciseBadge: { alignSelf: 'flex-start', backgroundColor: '#FFF8F0', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FF8C00', marginBottom: 20 },
  selectedExerciseText: { color: '#FF8C00', fontWeight: 'bold', fontSize: 15 },
  inputGrid: { flexDirection: 'row', marginBottom: 20 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 12, fontSize: 16, fontWeight: 'bold', color: '#333', borderWidth: 1, borderColor: '#EEE' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 15 },
  toggleLabel: { fontSize: 15, color: '#555', fontWeight: '500' },
  customToggle: { width: 50, height: 28, borderRadius: 14, backgroundColor: '#E0E0E0', padding: 2 },
  customToggleActive: { backgroundColor: '#FF8C00' },
  customToggleCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  customToggleCircleActive: { alignSelf: 'flex-end' },
  daySelector: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  dayChip: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EEE' },
  dayChipActive: { backgroundColor: '#FF8C00', borderColor: '#FF8C00' },
  dayChipText: { fontSize: 12, color: '#888', fontWeight: 'bold' },
  dayChipTextActive: { color: '#fff' },
  caloriePreview: { backgroundColor: '#FFF8F0', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  caloriePreviewText: { color: '#FF8C00', fontWeight: 'bold', fontSize: 18 },
  sleepPickerRow: { flexDirection: 'row', marginBottom: 25 },
  sleepPickerBox: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: '#EEE' },
  sleepPickerLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  sleepPickerTime: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  qualityRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 15 },
  qualityBtn: { padding: 10, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  qualityBtnActive: { borderColor: '#FF8C00', backgroundColor: '#FFF8F0' },
  stepperRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  stepperBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0E6D2', borderRadius: 16, padding: 5 },
  stepperBtn: { width: 40, height: 40, backgroundColor: '#fff', borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 1 },
  stepperBtnText: { fontSize: 24, color: '#333', fontWeight: 'bold' },
  stepperVal: { width: 50, textAlign: 'center', fontSize: 20, fontWeight: 'bold', color: '#FF8C00' },
});
