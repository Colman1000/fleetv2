import { Env } from './types';

export default {
  async queue(batch: MessageBatch<any>, env: Env['Bindings']): Promise<void> {
    for (const message of batch.messages) {
      const { taskId } = message.body;
      console.log(`Processing task ${taskId} from the auto-assign queue`);

      // 1. Fetch task details
      const task = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(taskId).first();
      if (!task) {
        console.error(`Task ${taskId} not found.`);
        continue;
      }

      // 2. Find available riders
      const { results: riders } = await env.DB.prepare('SELECT * FROM riders WHERE developer_id = ?').bind(task.developer_id).all();

      if (!riders || riders.length === 0) {
        console.log(`No riders found for developer ${task.developer_id}`);
        await env.DB.prepare('UPDATE tasks SET status = ? WHERE id = ?').bind('assignment_failed', taskId).run();
        continue;
      }

      let closestRider: any = null;
      let minDistance = Infinity;


      // 3. Find closest rider by checking their DO state
      for (const rider of riders) {
        const riderDO = env.RIDER_DO.get(env.RIDER_DO.idFromName(rider.id));
        const response = await riderDO.fetch('https://do/location');
        if (response.status === 200) {
          const riderState = await response.json();
          if (riderState.presence === 'available' && riderState.location) {
            const distance = getDistance(task.pickup_lat, task.pickup_lng, riderState.location.latitude, riderState.location.longitude);
            if (distance < minDistance) {
              minDistance = distance;
              closestRider = rider;
            }
          }
        }
      }

      if (closestRider) {
        console.log(`Assigning task ${taskId} to rider ${closestRider.id}`);
        // 4. Assign task to rider by calling a method on their DO
        const riderDO = env.RIDER_DO.get(env.RIDER_DO.idFromName(closestRider.id));
        const offer = {
          type: 'taskOffer',
          taskId: taskId,
          pickup: {
            lat: task.pickup_lat,
            lng: task.pickup_lng
          },
          destination: {
            lat: task.destination_lat,
            lng: task.destination_lng
          }
        }
        await riderDO.fetch('https://do/send', { method: "POST", body: JSON.stringify(offer) })
        await env.DB.prepare('UPDATE tasks SET status = ?, rider_id = ? WHERE id = ?').bind('assigned', closestRider.id, taskId).run();
        
        // 5. Send webhook
        await env.WEBHOOK_QUEUE.send({
          type: 'task.assigned',
          developerId: task.developer_id,
          data: {
            taskId,
            riderId: closestRider.id
          }
        });

      } else {
        console.log(`No available riders for task ${taskId}`);
        await env.DB.prepare('UPDATE tasks SET status = ? WHERE id = ?').bind('assignment_failed', taskId).run();
        
        await env.WEBHOOK_QUEUE.send({
          type: 'task.assignment_failed',
          developerId: task.developer_id,
          data: {
            taskId
          }
        });
      }
    }
  }
};

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
