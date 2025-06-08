import { createRiderSchema, updatePresenceSchema, updateLocationSchema, getAvailableRidersSchema } from '../schema';
import { describe, it, expect } from 'vitest';

describe('Rider Schemas', () => {
  describe('createRiderSchema', () => {
    it('should validate a valid rider creation payload', () => {
      const validPayload = {
        name: 'John Doe',
        phone: '+15551234567',
        email: 'john.doe@example.com',
        vehicle_type: 'motorcycle',
        tags: ['experienced', 'fast'],
      };
      const result = createRiderSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should validate a rider creation payload with only required fields', () => {
        const validPayload = {
          name: 'Jane Doe',
          phone: '+15557654321',
          vehicle_type: 'bicycle',
        };
        const result = createRiderSchema.safeParse(validPayload);
        expect(result.success).toBe(true);
      });

    it('should invalidate a rider creation payload with invalid vehicle type', () => {
      const invalidPayload = {
        name: 'John Doe',
        phone: '+15551234567',
        vehicle_type: 'boat', // Invalid type
      };
      const result = createRiderSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid enum value');
      }
    });

    it('should invalidate a rider creation payload with missing required fields', () => {
        const invalidPayload = {
          name: 'John Doe',
        };
        const result = createRiderSchema.safeParse(invalidPayload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some(issue => issue.path[0] === 'phone' && issue.message === 'Required')).toBe(true);
          expect(result.error.issues.some(issue => issue.path[0] === 'vehicle_type' && issue.message === 'Required')).toBe(true);
        }
      });

      it('should validate tags as an array of strings', () => {
        const validPayload = {
            name: 'John Doe',
            phone: '+15551234567',
            vehicle_type: 'motorcycle',
            tags: ['experienced', 'fast'],
          };
          const result = createRiderSchema.safeParse(validPayload);
          expect(result.success).toBe(true);

          const invalidPayload = {
            name: 'John Doe',
            phone: '+15551234567',
            vehicle_type: 'motorcycle',
            tags: ['experienced', 123], // Invalid tag type
          };
            const result2 = createRiderSchema.safeParse(invalidPayload);
            expect(result2.success).toBe(false);
            if (!result2.success) {
                expect(result2.error.issues.some(issue => issue.path[1] === 1 && issue.message === 'Expected string, received number')).toBe(true);
              }
      });
  });

  describe('updatePresenceSchema', () => {
    it('should validate a valid presence update payload', () => {
      const validPayload = { presence: 'available' };
      const result = updatePresenceSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should invalidate an invalid presence value', () => {
      const invalidPayload = { presence: 'sleeping' };
      const result = updatePresenceSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid enum value');
      }
    });
  });

  describe('updateLocationSchema', () => {
    it('should validate a valid location update payload', () => {
      const validPayload = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10,
        timestamp: Date.now(),
      };
      const result = updateLocationSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should validate a location update payload without accuracy', () => {
        const validPayload = {
          latitude: 40.7128,
          longitude: -74.0060,
          timestamp: Date.now(),
        };
        const result = updateLocationSchema.safeParse(validPayload);
        expect(result.success).toBe(true);
      });

    it('should invalidate a location update payload with invalid latitude', () => {
      const invalidPayload = {
        latitude: 100,
        longitude: -74.0060,
        timestamp: Date.now(),
      };
      const result = updateLocationSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Number must be less than or equal to 90');
      }
    });

    it('should invalidate a location update payload with invalid longitude', () => {
        const invalidPayload = {
          latitude: 40.7128,
          longitude: -200,
          timestamp: Date.now(),
        };
        const result = updateLocationSchema.safeParse(invalidPayload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Number must be less than or equal to 180');
        }
      });

      it('should invalidate a location update payload with missing timestamp', () => {
        const invalidPayload = {
          latitude: 40.7128,
          longitude: -74.0060,
        };
        const result = updateLocationSchema.safeParse(invalidPayload);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some(issue => issue.path[0] === 'timestamp' && issue.message === 'Required')).toBe(true);
          }
      });
  });

  describe('getAvailableRidersSchema', () => {
    it('should validate a valid query payload', () => {
      const validPayload = {
        lat: '40.7128',
        lng: '-74.0060',
        radius: '10',
        vehicle_type: 'car',
        tags: 'experienced,fast',
      };
      const result = getAvailableRidersSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should validate a valid query payload with only required fields', () => {
        const validPayload = {
          lat: '40.7128',
          lng: '-74.0060',
          radius: '10',
        };
        const result = getAvailableRidersSchema.safeParse(validPayload);
        expect(result.success).toBe(true);
      });

    it('should invalidate a query payload with invalid latitude', () => {
      const invalidPayload = {
        lat: '100',
        lng: '-74.0060',
        radius: '10',
      };
      const result = getAvailableRidersSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid input'); // Zod's default for transform + refine failure
      }
    });

    it('should invalidate a query payload with non-numeric radius', () => {
        const invalidPayload = {
          lat: '40.7128',
          lng: '-74.0060',
          radius: 'abc',
        };
        const result = getAvailableRidersSchema.safeParse(invalidPayload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Expected number, received nan');
        }
      });

  });
});
