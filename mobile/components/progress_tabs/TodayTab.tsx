import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ORANGE = '#FF8C00';
const YELLOW = '#FFD700';
const GREEN = '#4CD964';
const BLUE = '#4FC3F7';
const PURPLE = '#B39DDB';

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

export default function TodayTab({ data, goals }: any) {
  const latestLog = data?.logs?.[0] || {};
  const safeCalorieGoal = goals?.calorieGoal || 2000;
  const safeBurnGoal = goals?.caloriesBurntGoal || 300;
  const safeWaterGoal = goals?.waterGoal || 8;
  const safeStepGoal = goals?.stepGoal || 10000;
  const safeProteinGoal = goals?.proteinGoal || 150;

  const metrics = [
    { label: 'Calories', val: latestLog.caloriesConsumed || 0, goal: safeCalorieGoal, color: ORANGE },
    { label: 'Burnt', val: latestLog.caloriesBurnt || 0, goal: safeBurnGoal, color: YELLOW },
    { label: 'Water', val: latestLog.waterGlasses || 0, goal: safeWaterGoal, color: BLUE },
    { label: 'Steps', val: latestLog.steps || 0, goal: safeStepGoal, color: GREEN },
    { label: 'Protein', val: latestLog.proteinConsumed || 0, goal: safeProteinGoal, color: PURPLE },
  ];

  const overallAvg = metrics.reduce((acc, m) => acc + Math.min(m.val / m.goal, 1), 0) / metrics.length;
  const overallPct = Math.round(overallAvg * 100);

  let message = "Keep it up! You're making progress.";
  if (overallPct >= 100) message = "Amazing! You crushed your goals today! 🔥";
  else if (overallPct >= 80) message = "Great job! Almost at your goal! 🌟";
  else if (overallPct >= 50) message = "Halfway there! Keep pushing! 💪";

  const size = 300;
  const center = size / 2;

  // Render stats in a grid
  return (
    <View style={styles.container}>
      <View style={styles.ringsContainer}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {metrics.map((m, i) => {
            const rad = 135 - (i * 22);
            return (
              <ProgressRing
                key={i}
                progress={Math.min(m.val / m.goal, 1)}
                size={size}
                strokeWidth={16}
                color={m.color}
                radius={rad}
              />
            );
          })}
        </Svg>
        <View style={styles.centerText}>
          <Text style={styles.centerPct}>{overallPct}%</Text>
          <Text style={styles.centerSub}>Avg</Text>
        </View>
      </View>

      <View style={styles.messageBox}>
        <Text style={styles.msgText}>{message}</Text>
      </View>

      <View style={styles.statsGrid}>
        {metrics.map((m, i) => (
          <View key={i} style={styles.statPill}>
            <View style={[styles.dot, { backgroundColor: m.color }]} />
            <Text style={styles.statLabel}>{m.label}</Text>
            <Text style={styles.statVal}>{m.val} / {m.goal}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  ringsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginVertical: 20,
  },
  centerText: {
    position: 'absolute',
    alignItems: 'center',
  },
  centerPct: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#333',
  },
  centerSub: {
    fontSize: 14,
    color: '#888',
    textTransform: 'uppercase',
  },
  messageBox: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  msgText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  statPill: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
    fontWeight: '500',
  },
  statVal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
});
