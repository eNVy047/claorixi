import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Path, Circle, Text as SvgText, G } from 'react-native-svg';

const { width } = Dimensions.get('window');

const ORANGE = '#FF8C00';
const GREEN = '#4CD964';
const BLUE = '#4FC3F7';
const PURPLE = '#B39DDB';
const TEAL = '#008080';

export default function YearTab({ data }: any) {
  const [activeMetric, setActiveMetric] = useState('avgCalories');
  const [tooltip, setTooltip] = useState<any>(null);

  const metrics = [
    { key: 'avgCalories', label: 'Calories', color: ORANGE },
    { key: 'avgSteps', label: 'Steps', color: GREEN },
    { key: 'avgWeight', label: 'Weight', color: BLUE },
    { key: 'avgSleep', label: 'Sleep', color: PURPLE },
    { key: 'avgWater', label: 'Water', color: TEAL },
  ];

  const logs = data?.logs || [];
  const activeColor = metrics.find(m => m.key === activeMetric)?.color || ORANGE;

  // Summaries
  const totalStepsYear = logs.reduce((sum: number, l: any) => sum + (l.totalSteps || 0), 0);
  const avgCalsYear = logs.length > 0 ? Math.round(logs.reduce((sum: number, l: any) => sum + (l.avgCalories || 0), 0) / logs.length) : 0;
  
  const startWeight = logs.find((l: any) => l.weightAtMonthEnd)?.weightAtMonthEnd || 0;
  const endWeight = logs.length > 0 ? logs[logs.length - 1].weightAtMonthEnd || 0 : 0;
  const weightChange = endWeight - startWeight;

  const bestMonth = [...logs].sort((a: any, b: any) => (b.avgSteps || 0) - (a.avgSteps || 0))[0]?.month || '-';

  // Chart setup
  const chartHeight = 200;
  const chartWidth = width - 40;
  
  let validLogs = logs.filter((log: any) => log[activeMetric] !== undefined && log[activeMetric] !== null);
  
  const maxValue = validLogs.length > 0 
    ? Math.max(...validLogs.map((l: any) => l[activeMetric])) 
    : 100;
  
  const minValue = validLogs.length > 0 && activeMetric === 'avgWeight'
    ? Math.min(...validLogs.map((l: any) => l[activeMetric])) * 0.9 // Give some bottom padding for weight
    : 0;
    
  const range = maxValue - minValue || 1;
  const spacingX = chartWidth / (validLogs.length > 1 ? validLogs.length - 1 : 1);

  const points = validLogs.map((log: any, i: number) => {
    const x = i * spacingX;
    const y = chartHeight - (((log[activeMetric] - minValue) / range) * (chartHeight - 20)) - 10; // 10px padding top/bottom
    return { x, y, val: log[activeMetric], label: log.month.substring(5, 7) };
  });

  const pathData = points.length > 0 
    ? `M ${points.map((p: any) => `${p.x},${p.y}`).join(' L ')}` 
    : '';

  return (
    <View style={styles.container}>
      <View style={styles.chipContainer}>
        {metrics.map(m => (
          <TouchableOpacity
            key={m.key}
            style={[styles.chip, activeMetric === m.key && { backgroundColor: m.color }]}
            onPress={() => setActiveMetric(m.key)}
          >
            <Text style={[styles.chipText, activeMetric === m.key && styles.activeChipText]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={chartHeight + 30}>
          {points.length > 0 ? (
            <>
              <Path d={pathData} fill="none" stroke={activeColor} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
              {points.map((p: any, i: number) => (
                <G key={i}>
                  <Circle 
                    cx={p.x} 
                    cy={p.y} 
                    r={6} 
                    fill="#fff" 
                    stroke={activeColor} 
                    strokeWidth={2}
                    onPress={() => setTooltip(p)}
                  />
                  {/* Axis labels */}
                  <SvgText x={p.x} y={chartHeight + 20} fontSize="12" fill="#888" textAnchor="middle">
                    {p.label}
                  </SvgText>
                </G>
              ))}
              
              {tooltip && (
                <G>
                  <Path 
                    d={`M ${tooltip.x - 20} ${tooltip.y - 30} h 40 v 20 h -15 l -5 5 l -5 -5 h -15 z`} 
                    fill="#333" 
                  />
                  <SvgText x={tooltip.x} y={tooltip.y - 15} fontSize="10" fill="#fff" textAnchor="middle">
                    {typeof tooltip.val === 'number' && tooltip.val % 1 !== 0 ? tooltip.val.toFixed(1) : tooltip.val}
                  </SvgText>
                </G>
              )}
            </>
          ) : (
            <SvgText x={chartWidth / 2} y={chartHeight / 2} fontSize="14" fill="#888" textAnchor="middle">
              No data for this year yet.
            </SvgText>
          )}
        </Svg>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard title="Total Steps" val={totalStepsYear.toLocaleString()} />
        <SummaryCard title="Avg Calories" val={`${avgCalsYear} kcal`} />
        <SummaryCard title="Weight Change" val={`${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg`} />
        <SummaryCard title="Best Month" val={bestMonth.substring(5, 7)} />
      </View>
    </View>
  );
}

const SummaryCard = ({ title, val }: any) => (
  <View style={styles.summaryCard}>
    <Text style={styles.cardVal}>{val}</Text>
    <Text style={styles.cardTitle}>{title}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 10,
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
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  chipText: {
    color: '#666',
    fontWeight: '500',
    fontSize: 12,
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 10,
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
  },
});
