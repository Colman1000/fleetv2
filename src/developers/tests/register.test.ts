import { describe, it, expect, beforeAll } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('Developer Registration', () => {
  it('should register a new developer successfully', async () => {
    const res = await SELF.fetch('http://localhost/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
      }),
    });

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.message).toBe('Developer registered successfully');
  });

  it('should return an error for invalid email', async () => {
    const res = await SELF.fetch('http://localhost/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'invalid-email',
            password: 'password123',
        }),
    });
    expect(res.status).toBe(400);
  });

  it('should return an error for short password', async () => {
    const res = await SELF.fetch('http://localhost/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'test2@example.com',
            password: 'short',
        }),
    });
    expect(res.status).toBe(400);
  });
});
