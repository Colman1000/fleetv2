import { Env } from '../types';

export class RiderDO implements DurableObject {
  state: DurableObjectState;
  env: Env['Bindings'];
  sessions: WebSocket[] = [];
  presence: 'online' | 'offline' | 'busy' | 'available' = 'offline';
  location?: { latitude: number; longitude: number; accuracy?: number; timestamp: number };

  constructor(state: DurableObjectState, env: Env['Bindings']) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/websocket')) {
      const { 0: client, 1: server } = new WebSocketPair();
      this.sessions.push(server);
      server.accept();
      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === 'PATCH' && url.pathname.includes('/presence')) {
      const { presence } = await request.json<{ presence: typeof this.presence }>();
      this.presence = presence;
      this.broadcast(JSON.stringify({ type: 'presenceUpdate', presence: this.presence }));
      return new Response(JSON.stringify({ success: true, presence: this.presence }), { status: 200 });
    }
    
    if (request.method === 'PATCH' && url.pathname.includes('/location')) {
        const location = await request.json<typeof this.location>();
        this.location = location;
        this.broadcast(JSON.stringify({ type: 'locationUpdate', location: this.location }));
        return new Response(JSON.stringify({ success: true, location: this.location }), { status: 200 });
    }

    if (request.method === 'GET' && url.pathname.includes('/location')) {
      return new Response(JSON.stringify({ presence: this.presence, location: this.location }), { status: 200 });
    }

    if (request.method === 'POST' && url.pathname.includes('/send')) {
      const message = await request.json();
      this.broadcast(JSON.stringify(message));
      return new Response(JSON.stringify({ success: true }));
    }

    return new Response('Not found', { status: 404 });
  }

  broadcast(message: string) {
    this.sessions = this.sessions.filter(ws => {
      try {
        ws.send(message);
        return true;
      } catch (err) {
        return false;
      }
    });
  }
}
