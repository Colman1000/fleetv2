import { waypointSchema, createTaskSchema, listTasksSchema, updateTaskStatusSchema, assignTaskSchema } from '../schema';
import { describe, it, expect } from 'vitest';

describe('Task Schemas', () => {
  describe('waypointSchema', () => {
    it('should validate a valid waypoint', () => {
      const validWaypoint = {
        latitude: 6.5244,
        longitude: 3.3792,
        address: '123 Lagos St, Lagos',
        type: 'pickup',
        description: 'Pick up package',
        time_window: { start: '2025-06-10T08:00:00Z', end: '2025-06-10T09:00:00Z' },
        priority: 'high',
      };
      const result = waypointSchema.safeParse(validWaypoint);
      expect(result.success).toBe(true);
    });

    it('should validate a waypoint with only required fields', () => {
      const validWaypoint = {
        latitude: 6.5244,
        longitude: 3.3792,
        address: '123 Lagos St, Lagos',
        type: 'destination',
      };
      const result = waypointSchema.safeParse(validWaypoint);
      expect(result.success).toBe(true);
    });

    it('should invalidate a waypoint with invalid latitude', () => {
      const invalidWaypoint = {
        latitude: 100,
        longitude: 3.3792,
        address: '123 Lagos St, Lagos',
        type: 'pickup',
      };
      const result = waypointSchema.safeParse(invalidWaypoint);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Number must be less than or equal to 90');
      }
    });

    it('should invalidate a waypoint with invalid longitude', () => {
      const invalidWaypoint = {
        latitude: 6.5244,
        longitude: 200,
        address: '123 Lagos St, Lagos',
        type: 'pickup',
      };
      const result = waypointSchema.safeParse(invalidWaypoint);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Number must be less than or equal to 180');
      }
    });

    it('should invalidate a waypoint with a missing required field (address)', () => {
      const invalidWaypoint = {
        latitude: 6.5244,
        longitude: 3.3792,
        type: 'pickup',
      };
      const result = waypointSchema.safeParse(invalidWaypoint);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path[0] === 'address' && issue.message === 'Required')).toBe(true);
      }
    });

    it('should invalidate a waypoint with an invalid type', () => {
        const invalidWaypoint = {
          latitude: 6.5244,
          longitude: 3.3792,
          address: '123 Lagos St, Lagos',
          type: 'start', // Invalid type
        };
        const result = waypointSchema.safeParse(invalidWaypoint);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Invalid enum value');
        }
      });

      it('should validate optional time_window with valid datetime strings', () => {
        const validWaypoint = {
            latitude: 6.5244,
            longitude: 3.3792,
            address: '123 Lagos St, Lagos',
            type: 'pickup',
            time_window: { start: '2025-06-10T08:00:00Z', end: '2025-06-10T09:00:00Z' },
          };
          const result = waypointSchema.safeParse(validWaypoint);
          expect(result.success).toBe(true);
      });

        it('should invalidate optional time_window with invalid datetime strings', () => {
            const invalidWaypoint = {
                latitude: 6.5244,
                longitude: 3.3792,
                address: '123 Lagos St, Lagos',
                type: 'pickup',
                time_window: { start: 'invalid-date', end: '2025-06-10T09:00:00Z' },
              };
              const result = waypointSchema.safeParse(invalidWaypoint);
              expect(result.success).toBe(false);
              if (!result.success) {
                expect(result.error.issues[0].message).toBe('Invalid datetime string');
              }
          });
  });

  describe('createTaskSchema', () => {
    it('should validate a valid task creation payload', () => {
      const validPayload = {
        description: 'Deliver package',
        auto_assign: true,
        waypoints: [
          { latitude: 6.5244, longitude: 3.3792, address: 'Pickup location', type: 'pickup' },
          { latitude: 6.6000, longitude: 3.3500, address: 'Destination location', type: 'destination' },
        ],
        metadata: { fragile: true },
        webhook_url: 'https://example.com/webhook',
      };
      const result = createTaskSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should invalidate a task with less than two waypoints', () => {
      const invalidPayload = {
        description: 'Deliver package',
        auto_assign: true,
        waypoints: [
          { latitude: 6.5244, longitude: 3.3792, address: 'Pickup location', type: 'pickup' },
        ],
      };
      const result = createTaskSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Array must contain at least 2 element(s)');
      }
    });

    it('should invalidate a task without a pickup waypoint', () => {
      const invalidPayload = {
        description: 'Deliver package',
        auto_assign: true,
        waypoints: [
          { latitude: 6.5244, longitude: 3.3792, address: 'Stop 1', type: 'stop' },
          { latitude: 6.6000, longitude: 3.3500, address: 'Destination location', type: 'destination' },
        ],
      };
      const result = createTaskSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Waypoints must contain exactly one pickup and one destination.');
      }
    });

    it('should invalidate a task with more than one destination waypoint', () => {
        const invalidPayload = {
          description: 'Deliver package',
          auto_assign: true,
          waypoints: [
            { latitude: 6.5244, longitude: 3.3792, address: 'Pickup location', type: 'pickup' },
            { latitude: 6.6000, longitude: 3.3500, address: 'Destination 1', type: 'destination' },
            { latitude: 6.7000, longitude: 3.4500, address: 'Destination 2', type: 'destination' },
          ],
        };
        const result = createTaskSchema.safeParse(invalidPayload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Waypoints must contain exactly one pickup and one destination.');
        }
      });

      it('should invalidate a task with an invalid waypoint within the array', () => {
        const invalidPayload = {
          description: 'Deliver package',
          auto_assign: true,
          waypoints: [
            { latitude: 6.5244, longitude: 3.3792, address: 'Pickup location', type: 'pickup' },
            { latitude: 100, longitude: 3.3500, address: 'Destination location', type: 'destination' }, // Invalid latitude
          ],
        };
        const result = createTaskSchema.safeParse(invalidPayload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some(issue => issue.path[1] === 1 && issue.path[2] === 'latitude' && issue.message === 'Number must be less than or equal to 90')).toBe(true);
        }
      });

      it('should validate optional metadata as a record', () => {
        const validPayload = {
            description: 'Deliver package',
            auto_assign: true,
            waypoints: [
              { latitude: 6.5244, longitude: 3.3792, address: 'Pickup location', type: 'pickup' },
              { latitude: 6.6000, longitude: 3.3500, address: 'Destination location', type: 'destination' },
            ],
            metadata: { fragile: true, weight: 10 },
          };
          const result = createTaskSchema.safeParse(validPayload);
          expect(result.success).toBe(true);
      });

      it('should validate optional webhook_url as a valid URL', () => {
        const validPayload = {
            description: 'Deliver package',
            auto_assign: true,
            waypoints: [
              { latitude: 6.5244, longitude: 3.3792, address: 'Pickup location', type: 'pickup' },
              { latitude: 6.6000, longitude: 3.3500, address: 'Destination location', type: 'destination' },
            ],
            webhook_url: 'https://my.webhook.site/receive',
          };
          const result = createTaskSchema.safeParse(validPayload);
          expect(result.success).toBe(true);
      });

        it('should invalidate optional webhook_url with an invalid URL format', () => {
            const invalidPayload = {
                description: 'Deliver package',
                auto_assign: true,
                waypoints: [
                  { latitude: 6.5244, longitude: 3.3792, address: 'Pickup location', type: 'pickup' },
                  { latitude: 6.6000, longitude: 3.3500, address: 'Destination location', type: 'destination' },
                ],
                webhook_url: 'invalid-url',
              };
              const result = createTaskSchema.safeParse(invalidPayload);
              expect(result.success).toBe(false);
              if (!result.success) {
                expect(result.error.issues[0].message).toBe('Invalid url');
              }
          });
  });

  describe('listTasksSchema', () => {
    it('should validate a valid query payload with status', () => {
      const validPayload = { status: 'created' };
      const result = listTasksSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should validate an empty query payload', () => {
        const validPayload = {};
        const result = listTasksSchema.safeParse(validPayload);
        expect(result.success).toBe(true);
      });

    it('should invalidate a query payload with an invalid status value', () => {
      const invalidPayload = { status: 'in_progress' };
      const result = listTasksSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid enum value');
      }
    });
  });

  describe('updateTaskStatusSchema', () => {
    it('should validate a valid status update payload', () => {
      const validPayload = { status: 'en_route' };
      const result = updateTaskStatusSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should invalidate an invalid status value', () => {
      const invalidPayload = { status: 'pending' };
      const result = updateTaskStatusSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid enum value');
      }
    });

    it('should invalidate a payload with missing status', () => {
        const invalidPayload = {};
        const result = updateTaskStatusSchema.safeParse(invalidPayload);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some(issue => issue.path[0] === 'status' && issue.message === 'Required')).toBe(true);
          }
      });
  });

  describe('assignTaskSchema', () => {
    it('should validate a valid assign task payload', () => {
      const validPayload = { rider_id: 123 };
      const result = assignTaskSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should invalidate an assign task payload with non-numeric rider_id', () => {
      const invalidPayload = { rider_id: 'abc' };
      const result = assignTaskSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Expected number, received string');
      }
    });

    it('should invalidate an assign task payload with a non-positive rider_id', () => {
        const invalidPayload = { rider_id: 0 };
        const result = assignTaskSchema.safeParse(invalidPayload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Number must be greater than 0');
        }
      });

      it('should invalidate an assign task payload with missing rider_id', () => {
        const invalidPayload = {};
        const result = assignTaskSchema.safeParse(invalidPayload);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some(issue => issue.path[0] === 'rider_id' && issue.message === 'Required')).toBe(true);
          }
      });
  });
});
