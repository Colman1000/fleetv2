import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { registerDeveloperSchema } from './schema';
import { Env } from '../types';
import { hash } from 'bcryptjs';

const developers = new Hono<Env>();

developers.post('/register', zValidator('json', registerDeveloperSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const hashedPassword = await hash(password, 10);

  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO developers (email, hashed_password) VALUES (?, ?)'
    )
      .bind(email, hashedPassword)
      .run();

    return c.json({ success: true, message: 'Developer registered successfully' });
  } catch (error) {
    return c.json({ success: false, message: 'Error registering developer', error: error.message }, 500);
  }
});

export default developers;
