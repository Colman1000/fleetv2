import { Env } from './types';

export default {
  async queue(batch: MessageBatch<any>, env: Env['Bindings']): Promise<void> {
    for (const message of batch.messages) {
      const { type, developerId, data } = message.body;
      console.log(`Processing webhook for event type ${type}`);

      const developer = await env.DB.prepare('SELECT webhook_url FROM developers WHERE id = ?').bind(developerId).first();

      if (developer && developer.webhook_url) {
        try {
            const response = await fetch(developer.webhook_url, {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json',
                'X-Signature': '...your_hmac_signature_here...' // To be implemented
                },
                body: JSON.stringify({
                type,
                data
                })
            });

            if (!response.ok) {
                console.error(`Failed to send webhook for event ${type} to ${developer.webhook_url}. Status: ${response.status}`);
                // Implement retry logic here if needed
            }
        } catch(e) {
            console.error(`Exception while sending webhook for event ${type} to ${developer.webhook_url}. Error: ${e.message}`);
        }
      }
    }
  }
};
