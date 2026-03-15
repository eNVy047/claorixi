import { FastifyReply, FastifyRequest } from 'fastify';
import { DailyLog } from '../../models/DailyLog';
import { logger } from '../../utils/logger';
import { startOfDay, subDays, startOfWeek, startOfMonth, startOfYear, format } from 'date-fns';

export const getProgress = async (request: FastifyRequest<{ Querystring: { filter: string } }>, reply: FastifyReply) => {
  try {
    const userId = request.user.id;
    const { filter = 'today' } = request.query;

    let startDate: Date;
    const now = new Date();

    switch (filter) {
      case 'week':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
        startDate = startOfMonth(now);
        break;
      case 'year':
        startDate = startOfYear(now);
        break;
      default:
        startDate = startOfDay(now);
    }

    const logs = await DailyLog.find({
      userId,
      date: { $gte: format(startDate, 'yyyy-MM-dd'), $lte: format(now, 'yyyy-MM-dd') }
    }).sort({ date: 1 });

    // Calculate Streak
    const allLogs = await DailyLog.find({ userId }).sort({ date: -1 });
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    // Current Streak
    const todayStr = format(now, 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(now, 1), 'yyyy-MM-dd');
    
    let checkDate = todayStr;
    for (const log of allLogs) {
      if (log.date === checkDate && log.goalMet) {
        currentStreak++;
        checkDate = format(subDays(new Date(checkDate), 1), 'yyyy-MM-dd');
      } else if (log.date === yesterdayStr && !allLogs.find(l => l.date === todayStr)) {
          // If today isn't logged yet, but yesterday was a success, continue streak
          continue;
      } else {
        break;
      }
    }

    // Best Streak
    const sortedLogs = [...allLogs].sort((a, b) => a.date.localeCompare(b.date));
    tempStreak = 0;
    let lastDate: string | null = null;

    for (const log of sortedLogs) {
      if (log.goalMet) {
        if (!lastDate || format(subDays(new Date(log.date), 1), 'yyyy-MM-dd') === lastDate) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
        bestStreak = Math.max(bestStreak, tempStreak);
        lastDate = log.date;
      } else {
        tempStreak = 0;
        lastDate = log.date;
      }
    }

    return reply.send({
      success: true,
      data: {
        filter,
        logs,
        summary: {
          currentStreak,
          bestStreak,
        }
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching progress data');
    return reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};

export const logSleep = async (request: FastifyRequest<{ Body: { date: string, bedtime: string, wakeTime: string } }>, reply: FastifyReply) => {
  try {
    const userId = request.user.id;
    const { date, bedtime, wakeTime } = request.body;

    // Simple duration calculation (assume they sleep across midnight)
    const [bH, bM] = bedtime.split(':').map(Number);
    const [wH, wM] = wakeTime.split(':').map(Number);
    
    let sleepHours = wH - bH + (wM - bM) / 60;
    if (sleepHours < 0) sleepHours += 24;

    const sleepScore = Math.min(Math.round((sleepHours / 8) * 100), 100);

    const log = await DailyLog.findOneAndUpdate(
      { userId, date },
      { 
        bedtime, 
        wakeTime, 
        sleepHours: Number(sleepHours.toFixed(2)), 
        sleepScore 
      },
      { new: true, upsert: false }
    );

    if (!log) {
      return reply.status(404).send({ success: false, message: 'Daily log not found for this date' });
    }

    return reply.send({ success: true, data: log });
  } catch (error) {
    logger.error({ err: error }, 'Error logging sleep');
    return reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};

export const logMood = async (request: FastifyRequest<{ Body: { date: string, mood: string } }>, reply: FastifyReply) => {
  try {
    const userId = request.user.id;
    const { date, mood } = request.body;

    const log = await DailyLog.findOneAndUpdate(
      { userId, date },
      { mood },
      { new: true, upsert: false }
    );

    if (!log) {
      return reply.status(404).send({ success: false, message: 'Daily log not found for this date' });
    }

    return reply.send({ success: true, data: log });
  } catch (error) {
    logger.error({ err: error }, 'Error logging mood');
    return reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};
