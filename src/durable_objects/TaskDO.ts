import { Env } from '../types';

export class TaskDO implements DurableObject {
  state: DurableObjectState;
  env: Env['Bindings'];
  sessions: WebSocket[] = [];

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

    if (request.method === 'POST' && url.pathname.includes('/statusUpdate')) {
      const { status } = await request.json<{ status: string }>();
      this.broadcast(JSON.stringify({ type: 'statusUpdate', status}));
      return new Response(JSON.stringify({ success: true}));
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
