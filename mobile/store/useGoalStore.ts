import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';
import { format } from 'date-fns';

interface GoalStore {
  // Goals
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  waterGoal: number;
  stepGoal: number;
  caloriesBurntGoal: number;
  sleepGoal: number;

  // Consumed
  caloriesConsumed: number;
  proteinConsumed: number;
  carbsConsumed: number;
  fatConsumed: number;
  waterConsumed: number;
  stepsTaken: number;
  caloriesBurnt: number;

  // State log
  lastSyncDate: string | null; // YYYY-MM-DD
  isLoading: boolean;
  isSyncing: boolean;
  syncQueue: Array<{
    id: string;
    url: string;
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body: any;
  }>;

  // Actions
  fetchOverview: () => Promise<void>;
  updateConsumed: (updates: Partial<Pick<GoalStore, 'caloriesConsumed' | 'proteinConsumed' | 'carbsConsumed' | 'fatConsumed' | 'waterConsumed' | 'stepsTaken' | 'caloriesBurnt'>>) => void;
  setGoals: (goals: Partial<Pick<GoalStore, 'calorieGoal' | 'proteinGoal' | 'carbsGoal' | 'fatGoal' | 'waterGoal' | 'stepGoal' | 'caloriesBurntGoal' | 'sleepGoal'>>) => void;
  midnightReset: () => void;
  addToQueue: (request: Omit<GoalStore['syncQueue'][0], 'id'>) => void;
  processQueue: () => Promise<void>;
}

export const useGoalStore = create<GoalStore>()(
  persist(
    (set, get) => ({
      // Default Goals (Reference values)
      calorieGoal: 2000,
      proteinGoal: 150,
      carbsGoal: 200,
      fatGoal: 67,
      waterGoal: 8,
      stepGoal: 10000,
      caloriesBurntGoal: 500,
      sleepGoal: 8,

      // Initial Consumed
      caloriesConsumed: 0,
      proteinConsumed: 0,
      carbsConsumed: 0,
      fatConsumed: 0,
      waterConsumed: 0,
      stepsTaken: 0,
      caloriesBurnt: 0,

      lastSyncDate: null,
      isLoading: false,
      isSyncing: false,
      syncQueue: [],

      fetchOverview: async () => {
        set({ isLoading: true });
        try {
          const response = await api.get('/api/v1/dashboard/overview');
          if (response.data.success) {
            const { goals, consumed } = response.data.data;
            const today = format(new Date(), 'yyyy-MM-dd');
            
            set({
              calorieGoal: goals.calorieGoal,
              proteinGoal: goals.proteinGoal,
              carbsGoal: goals.carbsGoal,
              fatGoal: goals.fatGoal,
              waterGoal: goals.waterGlasses,
              stepGoal: goals.stepGoal,
              caloriesBurntGoal: goals.caloriesBurntGoal,
              sleepGoal: goals.sleepGoal,
              
              caloriesConsumed: consumed.caloriesConsumed,
              proteinConsumed: consumed.proteinConsumed,
              carbsConsumed: consumed.carbsConsumed,
              fatConsumed: consumed.fatConsumed,
              waterConsumed: consumed.waterConsumed,
              stepsTaken: consumed.stepsTaken,
              caloriesBurnt: consumed.caloriesBurnt,
              
              lastSyncDate: today,
              isLoading: false,
            });
          }
        } catch (error: any) {
          const { CrashService } = require('../lib/crashlytics');
          CrashService.recordError(error, 'FetchOverviewError');
          set({ isLoading: false });
        }
      },

      updateConsumed: (updates) => {
        set((state) => ({ ...state, ...updates }));
      },

      setGoals: (goals) => {
        set((state) => ({ ...state, ...goals }));
      },

      midnightReset: () => {
        const today = format(new Date(), 'yyyy-MM-dd');
        set({
          caloriesConsumed: 0,
          proteinConsumed: 0,
          carbsConsumed: 0,
          fatConsumed: 0,
          waterConsumed: 0,
          stepsTaken: 0,
          caloriesBurnt: 0,
          lastSyncDate: today,
        });
      },

      addToQueue: (request) => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({
          syncQueue: [...state.syncQueue, { ...request, id }],
        }));
      },

      processQueue: async () => {
        const { syncQueue, isSyncing } = get();
        if (syncQueue.length === 0 || isSyncing) return;

        set({ isSyncing: true });
        const remainingQueue = [...syncQueue];
        const processedIds: string[] = [];

        for (const req of remainingQueue) {
          try {
            await api({
              method: req.method,
              url: req.url,
              data: req.body,
            });
            processedIds.push(req.id);
          } catch (error: any) {
            const { CrashService } = require('../lib/crashlytics');
            CrashService.recordError(error, 'ProcessSyncQueueError');
            // If it's a 4xx error (except 429/408), we might want to drop it to avoid infinite loops
            // For now, we'll just keep it in queue if it's a network error
            if (error.response) {
               processedIds.push(req.id); // Drop if server rejected it (invalid data)
            } else {
              break; // Stop processing if still offline or network error
            }
          }
        }

        set((state) => ({
          syncQueue: state.syncQueue.filter((req) => !processedIds.includes(req.id)),
          isSyncing: false,
        }));
        
        // Refresh overview after successful sync to ensure consistency
        if (processedIds.length > 0) {
          get().fetchOverview();
        }
      },
    }),
    {
      name: 'caloxi-goal-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Helper for derived values — to be used as: const remaining = useGoalStore(state => state.calorieGoal - state.caloriesConsumed)
export const selectCaloriesRemaining = (state: GoalStore) => 
  state.calorieGoal - state.caloriesConsumed + state.caloriesBurnt;

export const selectCaloriesBurntRemaining = (state: GoalStore) =>
  Math.max(0, state.caloriesBurntGoal - state.caloriesBurnt);

export const selectWaterRemaining = (state: GoalStore) =>
  Math.max(0, state.waterGoal - state.waterConsumed);

export const selectStepsRemaining = (state: GoalStore) =>
  Math.max(0, state.stepGoal - state.stepsTaken);
