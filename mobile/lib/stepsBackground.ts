import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './api';

const TASK_NAME = 'STEP_SYNC_TASK';

const STORAGE_TOTAL_STEPS = '@steps_total_today';
const STORAGE_LAST_SYNCED_STEPS = '@steps_last_synced_today';

let isDefined = false;

function parseNumber(v: string | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function syncStepsToBackend(totalSteps: number) {
  const token = await AsyncStorage.getItem('authToken');
  if (!token) return;

  await fetch(`${API_BASE_URL}/api/v1/activity/steps`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ steps: totalSteps }),
  });
}

export async function registerStepBackgroundSync() {
  if (!isDefined) {
    TaskManager.defineTask(TASK_NAME, async () => {
      try {
        const total = parseNumber(await AsyncStorage.getItem(STORAGE_TOTAL_STEPS));
        const lastSynced = parseNumber(await AsyncStorage.getItem(STORAGE_LAST_SYNCED_STEPS));
        if (total <= 0 || total === lastSynced) {
          return BackgroundTask.BackgroundTaskResult.Success;
        }

        await syncStepsToBackend(total);
        await AsyncStorage.setItem(STORAGE_LAST_SYNCED_STEPS, String(total));
        return BackgroundTask.BackgroundTaskResult.Success;
      } catch (_) {
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    });
    isDefined = true;
  }

  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;

  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (!isRegistered) {
    await BackgroundTask.registerTaskAsync(TASK_NAME, {
      minimumInterval: 5 * 60, // seconds
    });
  }
}

export async function setStepsForBackgroundSync(totalStepsToday: number) {
  await AsyncStorage.setItem(STORAGE_TOTAL_STEPS, String(totalStepsToday));
}

