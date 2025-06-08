import { getDistance, deg2rad } from '../geometry';
import { describe, it, expect } from 'vitest';

describe('Geometry Utilities', () => {
  it('should calculate the distance between two points correctly', () => {
    // Coordinates for two points (e.g., New York City and Los Angeles)
    const lat1 = 40.7128;
    const lon1 = -74.0060;
    const lat2 = 34.0522;
    const lon2 = -118.2437;

    // Expected distance in kilometers (approximate)
    const expectedDistance = 3935.7;

    const calculatedDistance = getDistance(lat1, lon1, lat2, lon2);

    // Allow for a small margin of error due to floating-point arithmetic
    expect(calculatedDistance).toBeCloseTo(expectedDistance, 0);
  });

  it('should return 0 distance for the same point', () => {
    const lat1 = 34.0522;
    const lon1 = -118.2437;

    const calculatedDistance = getDistance(lat1, lon1, lat1, lon1);

    expect(calculatedDistance).toBe(0);
  });

  it('should calculate distance across the anti-meridian', () => {
    // Coordinates near the anti-meridian (e.g., Fiji and a point to its west)
    const lat1 = -17.7134;
    const lon1 = 178.0650; // Fiji
    const lat2 = -17.7134;
    const lon2 = -179.0000; // Just west of the anti-meridian

    // Approximate distance (should be small)
     const expectedDistance = 107.1;

    const calculatedDistance = getDistance(lat1, lon1, lat2, lon2);

    expect(calculatedDistance).toBeCloseTo(expectedDistance, 0);
  });

});
