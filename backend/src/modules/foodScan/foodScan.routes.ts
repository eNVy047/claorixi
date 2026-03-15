import { FastifyInstance } from 'fastify';
import { FoodScanController } from './foodScan.controller';

export default async function foodScanRoutes(fastify: FastifyInstance) {
  // All routes are protected
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.post('/analyze', FoodScanController.analyzeFood);
  fastify.post('/save', FoodScanController.saveFood);
}
