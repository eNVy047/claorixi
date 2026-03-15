import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { api } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Goals = {
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  waterGlasses: number;
  stepGoal: number;
  caloriesBurntGoal: number;
  sleepGoal: number;
};

type GoalContextType = {
  goals: Goals;
  isLoading: boolean;
  refreshGoals: () => Promise<void>;
};

// Sensible defaults while loading
const DEFAULT_GOALS: Goals = {
  calorieGoal: 2000,
  proteinGoal: 150,
  carbsGoal: 200,
  fatGoal: 67,
  waterGlasses: 8,
  stepGoal: 10000,
  caloriesBurntGoal: 300,
  sleepGoal: 8,
};

// ─── Context ──────────────────────────────────────────────────────────────────

const GoalContext = createContext<GoalContextType>({
  goals: DEFAULT_GOALS,
  isLoading: true,
  refreshGoals: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GoalProvider({ children }: { children: React.ReactNode }) {
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [isLoading, setIsLoading] = useState(true);

  const refreshGoals = useCallback(async () => {
    try {
      const response = await api.get('/api/v1/profile/goals');
      if (response.data.success) {
        setGoals(response.data.data);
      }
    } catch (_) {
      // Silently fail — default goals remain in place
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshGoals();
  }, []);

  return (
    <GoalContext.Provider value={{ goals, isLoading, refreshGoals }}>
      {children}
    </GoalContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGoals(): GoalContextType {
  return useContext(GoalContext);
}
