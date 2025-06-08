import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    environmentOptions: {
      modules: true,
      scriptPath: './src/index.ts',
      d1Databases: ['DB'],
      durableObjects: {
        TASK_DO: 'TaskDO',
        RIDER_DO: 'RiderDO',
      },
      queueProducers: {
        AUTO_ASSIGN_QUEUE: 'AUTO_ASSIGN_QUEUE',
        WEBHOOK_QUEUE: 'WEBHOOK_QUEUE',
      },
    },
  },
});
