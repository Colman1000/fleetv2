import api from './api';
import { RiderDO } from './durable_objects/RiderDO';
import { TaskDO } from './durable_objects/TaskDO';
import { Env } from './types';

export default {
  fetch: api.fetch,

  async queue(batch: MessageBatch<any>, env: Env['Bindings']): Promise<void> {
    for (const message of batch.messages) {
      // Determine which queue the message came from and process it.
      if (message.queue.endsWith("AUTO_ASSIGN_QUEUE")) {
        await handleAutoAssign(message, env);
      } else if (message.queue.endsWith("WEBHOOK_QUEUE")) {
        await handleWebhook(message, env);
      }
    }
  }
};

async function handleAutoAssign(message: Message<any>, env: Env['Bindings']) {
  const { taskId } = message.body;
  console.log(`Processing task ${taskId} from the auto-assign queue`);

  const task = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(taskId).first();
  if (!task) {
    console.error(`Task ${taskId} not found.`);
    return;
  }

  const { results: riders } = await env.DB.prepare('SELECT * FROM riders WHERE developer_id = ?').bind(task.developer_id).all();

  if (!riders || riders.length === 0) {
    console.log(`No riders found for developer ${task.developer_id}`);
    return;
  }

  let closestRider: any = null;
  let minDistance = Infinity;

  for (const rider of riders) {
    const riderDO = env.RIDER_DO.get(env.RIDER_DO.idFromName(rider.id));
    const response = await riderDO.fetch('https://do/location');
    if (response.status === 200) {
      const riderLocation = await response.json();
      if (riderLocation.presence === 'available' && riderLocation.location) {
        const distance = getDistance(task.pickup_lat, task.pickup_lng, riderLocation.location.latitude, riderLocation.location.longitude);
        if (distance < minDistance) {
          minDistance = distance;
          closestRider = rider;
        }
      }
    }
  }

  if (closestRider) {
    console.log(`Assigning task ${taskId} to rider ${closestRider.id}`);
    const riderDO = env.RIDER_DO.get(env.RIDER_DO.idFromName(closestRider.id));
    const offer = {
      type: 'taskOffer',
      taskId: taskId,
      pickup: { lat: task.pickup_lat, lng: task.pickup_lng },
      destination: { lat: task.destination_lat, lng: task.destination_lng }
    };
    await riderDO.fetch('https://do/send', { method: "POST", body: JSON.stringify(offer) });
    await env.DB.prepare('UPDATE tasks SET status = ? WHERE id = ?').bind('assigned', taskId).run();
    await env.WEBHOOK_QUEUE.send({
      type: 'task.assigned',
      developerId: task.developer_id,
      data: { taskId, riderId: closestRider.id }
    });
  } else {
    console.log(`No available riders for task ${taskId}`);
    await env.DB.prepare('UPDATE tasks SET status = ? WHERE id = ?').bind('assignment_failed', taskId).run();
    await env.WEBHOOK_QUEUE.send({
      type: 'task.assignment_failed',
      developerId: task.developer_id,
      data: { taskId }
    });
  }
}

async function handleWebhook(message: Message<any>, env: Env['Bindings']) {
    const { type, developerId, data } = message.body;
    console.log(`Processing webhook for event type ${type}`);

    const developerResult: { webhook_url?: string } = await env.DB.prepare('SELECT webhook_url FROM developers WHERE id = ?').bind(developerId).first();

    if (developerResult && developerResult.webhook_url) {
        const response = await fetch(developerResult.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, data })
        });

        if (!response.ok) {
            console.error(`Failed to send webhook for event ${type} to ${developerResult.webhook_url}`);
            // In a real app, you would add retry logic here.
        }
    }
}


function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
    ;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180)
}

export { RiderDO, TaskDO };
