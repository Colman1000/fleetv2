import { createApiKeySchema } from '../schema';
import { describe, it, expect } from 'vitest';

describe('API Key Schemas', () => {
  it('should validate a valid API key creation payload', () => {
    const validPayload = {
      scopes: ['admin', 'read-only'],
      expires_at: new Date().toISOString(),
    };
    const result = createApiKeySchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('should validate a valid API key creation payload without expires_at', () => {
    const validPayload = {
      scopes: ['rider'],
    };
    const result = createApiKeySchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('should invalidate a payload with invalid scope values', () => {
    const invalidPayload = {
      scopes: ['admin', 'invalid-scope'],
      expires_at: new Date().toISOString(),
    };
    const result = createApiKeySchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Invalid enum value');
    }
  });

  it('should invalidate a payload with scopes not as an array', () => {
    const invalidPayload = {
      scopes: 'admin',
      expires_at: new Date().toISOString(),
    };
    const result = createApiKeySchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
        expect(result.error.issues[0].message).toBe('Expected array, received string');
      }
  });

  it('should invalidate a payload with an invalid expires_at format', () => {
    const invalidPayload = {
      scopes: ['admin'],
      expires_at: 'invalid-date',
    };
    const result = createApiKeySchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid datetime string');
    }
  });

});
