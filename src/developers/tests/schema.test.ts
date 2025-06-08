import { registerDeveloperSchema } from '../schema';
import { describe, it, expect } from 'vitest';

describe('Developer Schemas', () => {
  it('should validate a valid developer registration payload', () => {
    const validPayload = {
      email: 'test@example.com',
      password: 'securepassword123',
    };
    const result = registerDeveloperSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('should invalidate an invalid email format', () => {
    const invalidPayload = {
      email: 'invalid-email',
      password: 'securepassword123',
    };
    const result = registerDeveloperSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid email');
    }
  });

  it('should invalidate a password shorter than 8 characters', () => {
    const invalidPayload = {
      email: 'test@example.com',
      password: 'short',
    };
    const result = registerDeveloperSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('String must contain at least 8 character(s)');
    }
  });

  it('should invalidate a payload with missing fields', () => {
    const invalidPayload = {
      email: 'test@example.com',
    };
    const result = registerDeveloperSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(issue => issue.path[0] === 'password' && issue.message === 'Required')).toBe(true);
    }
  });
});
