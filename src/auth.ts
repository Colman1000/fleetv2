import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { Bindings } from './types'
import { compare } from 'bcryptjs';

export const authMiddleware = createMiddleware<{ Bindings: Bindings, Variables: { developerId: string } }>(async (c, next) => {
    const apiKey = c.req.header('X-Api-Key')
    if (!apiKey) {
        throw new HTTPException(401, { message: 'Unauthorized, API key is missing' })
    }

    const prefix = apiKey.substring(0, 6);

    try {
        const results = await c.env.DB.prepare('SELECT id, developer_id, key_hash, scopes, expires_at FROM api_keys WHERE prefix = ?').bind(prefix).all();
        let validKey = false;
        let developerId = '';

        for (const row of results.results) {
            const isMatch = await compare(apiKey, row.key_hash);
            if (isMatch) {
                if (row.expires_at && new Date(row.expires_at) < new Date()) {
                    throw new HTTPException(401, { message: 'Unauthorized, API key has expired' });
                }
                validKey = true;
                developerId = row.developer_id;
                break;
            }
        }

        if (!validKey) {
            throw new HTTPException(401, { message: 'Unauthorized, invalid API key' });
        }

        c.set('developerId', developerId)

    } catch (error) {
        if (error instanceof HTTPException) {
            throw error;
        }
        throw new HTTPException(500, { message: 'Internal server error', cause: error.message })
    }


    await next()
})
