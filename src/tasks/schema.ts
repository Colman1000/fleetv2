import { z } from 'zod';

export const waypointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().min(1),
  type: z.enum(['pickup', 'stop', 'destination']),
  description: z.string().optional(),
  time_window: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }).optional(),
  priority: z.string().optional(),
});

export const createTaskSchema = z.object({
  description: z.string().min(1),
  auto_assign: z.boolean(),
  waypoints: z.array(waypointSchema).min(2)
    .refine(
      (waypoints) => {
        const pickupCount = waypoints.filter((wp) => wp.type === 'pickup').length;
        const destinationCount = waypoints.filter((wp) => wp.type === 'destination').length;
        return pickupCount === 1 && destinationCount === 1;
      },
      { message: 'Waypoints must contain exactly one pickup and one destination.' }
    ),
  metadata: z.record(z.any()).optional(),
  webhook_url: z.string().url().optional(),
});

export const listTasksSchema = z.object({
  status: z.enum(['created', 'assigned', 'accepted', 'en_route', 'arrived', 'completed', 'cancelled']).optional(),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(['created', 'assigned', 'accepted', 'en_route', 'arrived', 'completed', 'cancelled']),
});

export const assignTaskSchema = z.object({
    rider_id: z.number().positive(),
});
