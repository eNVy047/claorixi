import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

const DARK_GREEN = '#228B22';
const LIGHT_GREEN = '#90EE90';
const ORANGE = '#FF8C00';
const GREY = '#E0E0E0';

export default function MonthTab({ data, goals }: any) {
  const [selectedDay, setSelectedDay] = useState<any>(null);

  const logs = data?.logs || [];
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const safeCalorieGoal = goals?.calorieGoal || 2000;

  // Build a lookup map of logs by date string
  const logMap = logs.reduce((acc: any, log: any) => {
    acc[log.date] = log;
    return acc;
  }, {});

  const startDayOfWeek = getDay(monthStart); // 0 = Sunday, 1 = Monday
  const blankDays = Array.from({ length: startDayOfWeek }).map((_, i) => <View key={`blank-${i}`} style={styles.cell} />);

  const daysGoalMetCount = logs.filter((l: any) => l.goalMet).length;
  const totalSteps = logs.reduce((sum: number, l: any) => sum + (l.steps || 0), 0);
  const avgCals = logs.length > 0 ? logs.reduce((sum: number, l: any) => sum + (l.caloriesConsumed || 0), 0) / logs.length : 0;
  const totalBurnt = logs.reduce((sum: number, l: any) => sum + (l.caloriesBurnt || 0), 0);

  const getHeatmapColor = (log: any) => {
    if (!log) return GREY;
    const progress = log.caloriesConsumed / safeCalorieGoal;
    if (log.goalMet || progress >= 1) return DARK_GREEN;
    if (progress >= 0.6) return LIGHT_GREEN;
    if (progress >= 0.3) return ORANGE;
    return GREY;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.monthHeader}>{format(now, 'MMMM yyyy')}</Text>

      <View style={styles.calendarCard}>
        <View style={styles.weekDays}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <Text key={d} style={styles.weekDayText}>{d}</Text>
          ))}
        </View>
        <View style={styles.grid}>
          {blankDays}
          {daysInMonth.map((date) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const log = logMap[dateStr];
            const color = getHeatmapColor(log);
            return (
              <TouchableOpacity
                key={dateStr}
                style={[styles.cell, { backgroundColor: color }]}
                onPress={() => log && setSelectedDay(log)}
              >
                <Text style={[styles.cellText, color === GREY ? { color: '#888' } : { color: '#fff' }]}>
                  {format(date, 'd')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard title="Days Goal Met" val={`${daysGoalMetCount} / ${daysInMonth.length}`} icon="trophy-outline" />
        <SummaryCard title="Total Steps" val={totalSteps.toLocaleString()} icon="walk-outline" />
        <SummaryCard title="Avg Calories" val={`${Math.round(avgCals)}`} icon="flame-outline" />
        <SummaryCard title="Total Burnt" val={`${totalBurnt} kcal`} icon="bonfire-outline" />
      </View>

      {selectedDay && (
        <Modal animationType="slide" transparent={true} visible={!!selectedDay} onRequestClose={() => setSelectedDay(null)}>
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{format(parseISO(selectedDay.date), 'MMM do, yyyy')}</Text>
                <TouchableOpacity onPress={() => setSelectedDay(null)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              <Text>Calories: {selectedDay.caloriesConsumed} / {safeCalorieGoal}</Text>
              <Text>Steps: {selectedDay.steps}</Text>
              <Text>Water: {selectedDay.waterGlasses} glasses</Text>
              <Text>Sleep: {selectedDay.sleepHours} hrs</Text>
              <View style={styles.macroRow}>
                <Text>P: {selectedDay.proteinConsumed}g</Text>
                <Text>C: {selectedDay.carbsConsumed}g</Text>
                <Text>F: {selectedDay.fatConsumed}g</Text>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const SummaryCard = ({ title, val, icon }: any) => (
  <View style={styles.summaryCard}>
    <Ionicons name={icon} size={24} color={ORANGE} style={{ marginBottom: 5 }} />
    <Text style={styles.cardVal}>{val}</Text>
    <Text style={styles.cardTitle}>{title}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
  monthHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  weekDayText: {
    fontSize: 12,
    color: '#888',
    width: 35,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  cell: {
    width: '13.5%', // Slightly less than 14.28% to account for margin
    aspectRatio: 1,
    margin: '0.3%',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellText: {
    fontSize: 12,
    fontWeight: 'bold',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 12,
    color: '#888',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    padding: 25,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderColor: '#eee',
  }
});
