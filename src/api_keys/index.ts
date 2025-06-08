import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createApiKeySchema } from './schema';
import { authMiddleware } from '../auth';
import { Env } from '../types';
import { hash } from 'bcryptjs';

const apiKeys = new Hono<Env>();

apiKeys.use('*', authMiddleware);

apiKeys.post('/', zValidator('json', createApiKeySchema), async (c) => {
  const { scopes, expires_at } = c.req.valid('json');
  const developerId = c.get('developerId');

  const apiKey = `sk_${[...crypto.getRandomValues(new Uint8Array(24))].map(n => n.toString(36)).join('')}`;
  const prefix = apiKey.substring(0, 6);
  const hashedKey = await hash(apiKey, 10);

  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO api_keys (developer_id, prefix, key_hash, scopes, expires_at) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(developerId, prefix, hashedKey, JSON.stringify(scopes), expires_at)
      .run();

    return c.json({
      success: true,
      message: 'API key created successfully',
      data: {
        apiKey,
        scopes,
        expires_at,
      },
    });
  } catch (error) {
    return c.json({ success: false, message: 'Error creating API key', error: error.message }, 500);
  }
});

export default apiKeys;
