import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Rect, Text as SvgText, G, Line } from 'react-native-svg';
import { format, parseISO } from 'date-fns';

const { width } = Dimensions.get('window');

const ORANGE = '#FF8C00';
const GREEN = '#4CD964';
const YELLOW = '#FFD700';
const RED = '#FF3B30';
const BLUE = '#4FC3F7';
const PURPLE = '#B39DDB';

export default function WeekTab({ data, goals }: any) {
  const [activeMetric, setActiveMetric] = useState('Calories');
  const metrics = ['Calories', 'Steps', 'Water', 'Sleep'];

  const logs = data?.logs || [];
  const summary = data?.summary || {};

  const safeCalorieGoal = goals?.calorieGoal || 2000;
  const safeStepGoal = goals?.stepGoal || 10000;
  const safeWaterGoal = goals?.waterGoal || 8;
  const safeSleepGoal = goals?.sleepGoal || 8;

  const getMetricData = (metric: string) => {
    return logs.map((log: any) => {
      let y = 0;
      let goal = 1;
      let label = '';
      switch (metric) {
        case 'Calories':
          y = log.caloriesConsumed || 0;
          goal = safeCalorieGoal;
          label = `${y}`;
          break;
        case 'Steps':
          y = log.steps || 0;
          goal = safeStepGoal;
          label = `${y}`;
          break;
        case 'Water':
          y = log.waterGlasses || 0;
          goal = safeWaterGoal;
          label = `${y}`;
          break;
        case 'Sleep':
          y = log.sleepHours || 0;
          goal = safeSleepGoal;
          label = `${y}`;
          break;
      }

      const pct = y / goal;
      let fill = RED;
      if (pct >= 1) fill = GREEN;
      else if (pct >= 0.6) fill = YELLOW;

      return {
        x: format(parseISO(log.date), 'EEE'),
        y,
        pct: Math.min(pct, 1), // Cap at 100% for bar height
        fill,
        label,
        goal
      };
    });
  };

  const chartData = getMetricData(activeMetric);

  // Chart setup
  const chartHeight = 200;
  const chartWidth = width - 40;
  const barWidth = 20;
  const spacing = (chartWidth - (chartData.length * barWidth)) / (chartData.length + 1);

  // Summaries
  const avgCals = logs.length > 0 ? Math.round(logs.reduce((sum: number, l: any) => sum + (l.caloriesConsumed || 0), 0) / logs.length) : 0;
  const totalSteps = logs.reduce((sum: number, l: any) => sum + (l.steps || 0), 0);
  const avgSleep = logs.length > 0 ? (logs.reduce((sum: number, l: any) => sum + (l.sleepHours || 0), 0) / logs.length).toFixed(1) : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.streakText}>🔥 {summary.currentStreak || 0} day streak — keep it up!</Text>

      <View style={styles.chipContainer}>
        {metrics.map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.chip, activeMetric === m && styles.activeChip]}
            onPress={() => setActiveMetric(m)}
          >
            <Text style={[styles.chipText, activeMetric === m && styles.activeChipText]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={chartHeight + 40}>
          {/* Goal Line */}
          <Line x1="0" y1={40} x2={chartWidth} y2={40} stroke="#E0E0E0" strokeWidth="2" strokeDasharray="5, 5" />
          <SvgText x={chartWidth - 10} y={35} fontSize="10" fill="#AAA" textAnchor="end">Goal</SvgText>

          {chartData.map((d: any, i: number) => {
            const xOffset = spacing + (i * (barWidth + spacing));
            const availableHeight = chartHeight - 40; // reserve 40 for top label
            const barHeight = d.pct * availableHeight;
            const yOffset = chartHeight - barHeight;

            return (
              <G key={i}>
                <Rect
                  x={xOffset}
                  y={yOffset}
                  width={barWidth}
                  height={barHeight}
                  fill={d.fill}
                  rx={4}
                />
                <SvgText
                  x={xOffset + barWidth / 2}
                  y={yOffset - 5}
                  fontSize="10"
                  fill="#666"
                  textAnchor="middle"
                >
                  {d.label}
                </SvgText>
                <SvgText
                  x={xOffset + barWidth / 2}
                  y={chartHeight + 15}
                  fontSize="12"
                  fill="#888"
                  textAnchor="middle"
                >
                  {d.x}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard title="Avg Calories" val={`${avgCals} kcal`} />
        <SummaryCard title="Total Steps" val={totalSteps.toLocaleString()} />
        <SummaryCard title="Avg Sleep" val={`${avgSleep} hours`} />
      </View>
    </View>
  );
}

const SummaryCard = ({ title, val }: { title: string, val: string }) => (
  <View style={styles.summaryCard}>
    <Text style={styles.cardVal}>{val}</Text>
    <Text style={styles.cardTitle}>{title}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
  streakText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ORANGE,
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  chipContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  chip: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  activeChip: {
    backgroundColor: ORANGE,
  },
  chipText: {
    color: '#666',
    fontWeight: '500',
  },
  activeChipText: {
    color: '#fff',
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  cardVal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
});
