import { z } from 'zod';

export const createApiKeySchema = z.object({
  scopes: z.array(z.enum(['admin', 'read-only', 'rider'])),
  expires_at: z.string().datetime().optional(),
});
