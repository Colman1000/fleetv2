import { z } from 'zod';

export const createRiderSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  vehicle_type: z.enum(['motorcycle', 'bicycle', 'truck_small', 'truck_large', 'car', 'foot']),
  tags: z.array(z.string()).optional(),
});

export const updatePresenceSchema = z.object({
    presence: z.enum(['online', 'offline', 'busy', 'available']),
});

export const updateLocationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().optional(),
    timestamp: z.number(),
});

export const getAvailableRidersSchema = z.object({
    lat: z.string().transform(Number).refine(val => Math.abs(val) <= 90),
    lng: z.string().transform(Number).refine(val => Math.abs(val) <= 180),
    radius: z.string().transform(Number).positive(),
    vehicle_type: z.enum(['motorcycle', 'bicycle', 'truck_small', 'truck_large', 'car', 'foot']).optional(),
    tags: z.string().optional(),
});
