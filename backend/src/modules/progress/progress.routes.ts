import { FastifyInstance } from 'fastify';
import {
  getProgress,
  logSleep,
  logMood,
} from './progress.controller';

export default async function progressRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);
  app.get('/', getProgress);
  app.patch('/sleep', logSleep);
  app.patch('/mood', logMood);
}
