import { FastifyInstance } from 'fastify';
import { ActivityController } from './activity.controller';

export default async function activityRoutes(fastify: FastifyInstance) {
  fastify.get('/today', { preValidation: [fastify.authenticate] }, ActivityController.getTodayActivity);
  fastify.patch('/steps', { preValidation: [fastify.authenticate] }, ActivityController.updateSteps);
  fastify.post('/exercise', { preValidation: [fastify.authenticate] }, ActivityController.logExercise);
  fastify.delete('/exercise/:id', { preValidation: [fastify.authenticate] }, ActivityController.deleteExercise);
  fastify.get('/library', { preValidation: [fastify.authenticate] }, ActivityController.getLibrary);

  // Sleep & Routine
  fastify.post('/sleep', { preValidation: [fastify.authenticate] }, ActivityController.logSleep);
  fastify.get('/routine', { preValidation: [fastify.authenticate] }, ActivityController.getRoutine);
  fastify.put('/routine/:id', { preValidation: [fastify.authenticate] }, ActivityController.updateRoutine);
  fastify.delete('/routine/:id', { preValidation: [fastify.authenticate] }, ActivityController.deleteRoutine);
}
