import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../auth';
import { createTaskSchema, listTasksSchema, updateTaskStatusSchema, assignTaskSchema } from './schema';
import { Env } from '../types';
import { getDistance } from '../utils/geometry';

const tasks = new Hono<Env>();

tasks.use('*', authMiddleware);

tasks.post('/', zValidator('json', createTaskSchema), async (c) => {
  const taskData = c.req.valid('json');
  const developerId = c.get('developerId');

  const pickup = taskData.waypoints.find(wp => wp.type === 'pickup');
  const destination = taskData.waypoints.find(wp => wp.type === 'destination');

  try {
    const taskResult = await c.env.DB.prepare(
      'INSERT INTO tasks (developer_id, description, auto_assign, metadata, pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(
        developerId,
        taskData.description,
        taskData.auto_assign,
        JSON.stringify(taskData.metadata),
        pickup.latitude,
        pickup.longitude,
        pickup.address,
        destination.latitude,
        destination.longitude,
        destination.address,
        'created'
      )
      .run();

    const taskId = taskResult.meta.last_row_id;

    const stmt = c.env.DB.prepare(
      'INSERT INTO waypoints (task_id, latitude, longitude, address, type, description, time_window_start, time_window_end, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const inserts = taskData.waypoints.map(wp =>
      stmt.bind(
        taskId,
        wp.latitude,
        wp.longitude,
        wp.address,
        wp.type,
        wp.description,
        wp.time_window?.start,
        wp.time_window?.end,
        wp.priority
      )
    );

    await c.env.DB.batch(inserts);

    if (taskData.auto_assign) {
      await c.env.AUTO_ASSIGN_QUEUE.send({ taskId });
    }

    return c.json({ success: true, message: 'Task created successfully', data: { id: taskId, ...taskData } });
  } catch (error) {
    return c.json({ success: false, message: 'Error creating task', error: error.message }, 500);
  }
});

tasks.get('/', zValidator('query', listTasksSchema), async (c) => {
  const { status } = c.req.valid('query');
  const developerId = c.get('developerId');

  let query = 'SELECT * FROM tasks WHERE developer_id = ?';
  const params = [developerId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  try {
    const tasks = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ success: true, data: tasks.results });
  } catch (error) {
    return c.json({ success: false, message: 'Error fetching tasks', error: error.message }, 500);
  }
});

tasks.get('/:id', async (c) => {
  const taskId = c.req.param('id');
  const developerId = c.get('developerId');

  try {
    const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND developer_id = ?').bind(taskId, developerId).first();

    if (!task) {
      return c.json({ success: false, message: 'Task not found' }, 404);
    }

    const waypoints = await c.env.DB.prepare('SELECT * FROM waypoints WHERE task_id = ?').bind(taskId).all();

    return c.json({ success: true, data: { ...task, waypoints: waypoints.results } });
  } catch (error) {
    return c.json({ success: false, message: 'Error fetching task', error: error.message }, 500);
  }
});

tasks.get('/:id/available', async (c) => {
    const taskId = c.req.param('id');
    const developerId = c.get('developerId');

    const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND developer_id = ?').bind(taskId, developerId).first();
    if (!task) {
        return c.json({ success: false, message: 'Task not found' }, 404);
    }

    const { results: allRiders } = await c.env.DB.prepare('SELECT * FROM riders WHERE developer_id = ?').bind(developerId).all();

    const availableRiders = [];
    await Promise.all(allRiders.map(async (rider) => {
        const doId = c.env.RIDER_DO.idFromName(rider.id.toString());
        const stub = c.env.RIDER_DO.get(doId);
        const res = await stub.fetch('https://do/location');

        if (res.status === 200) {
            const riderState = await res.json();
            if (riderState.presence === 'available' && riderState.location) {
                const distance = getDistance(task.pickup_lat, task.pickup_lng, riderState.location.latitude, riderState.location.longitude);
                availableRiders.push({ ...rider, distance, location: riderState.location });
            }
        }
    }));

    availableRiders.sort((a, b) => a.distance - b.distance);

    return c.json({ success: true, data: availableRiders });
});

tasks.patch('/:id/assign', zValidator('json', assignTaskSchema), async (c) => {
    const taskId = c.req.param('id');
    const { rider_id } = c.req.valid('json');
    const developerId = c.get('developerId');

    // 1. Check if task and rider exist and belong to the developer
    const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND developer_id = ?').bind(taskId, developerId).first();
    if (!task) {
        return c.json({ success: false, message: 'Task not found' }, 404);
    }

    const rider = await c.env.DB.prepare('SELECT * FROM riders WHERE id = ? AND developer_id = ?').bind(rider_id, developerId).first();
    if (!rider) {
        return c.json({ success: false, message: 'Rider not found' }, 404);
    }
    
    // 2. Update task status and assign rider
    await c.env.DB.prepare('UPDATE tasks SET status = ?, rider_id = ? WHERE id = ?').bind('assigned', rider_id, taskId).run();

    // 3. Notify rider via Durable Object
    const riderDO = c.env.RIDER_DO.get(c.env.RIDER_DO.idFromName(rider_id.toString()));
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
    
    // 4. Send webhook
    await c.env.WEBHOOK_QUEUE.send({
        type: 'task.assigned',
        developerId: developerId,
        data: {
            taskId,
            riderId: rider_id
        }
    });
    
    return c.json({ success: true, message: 'Task assigned successfully' });
});


tasks.patch('/:id/status', zValidator('json', updateTaskStatusSchema), async (c) => {
  const taskId = c.req.param('id');
  const { status } = c.req.valid('json');
  const developerId = c.get('developerId');

  try {
    const result = await c.env.DB.prepare('UPDATE tasks SET status = ? WHERE id = ? AND developer_id = ?')
      .bind(status, taskId, developerId)
      .run();
    
    if (result.meta.changes === 0) {
      return c.json({ success: false, message: 'Task not found or you do not have permission to update it' }, 404);
    }

    const taskDurableObject = c.env.TASK_DO.get(c.env.TASK_DO.idFromString(taskId));
    await taskDurableObject.fetch(new Request(`https://do/statusUpdate`, { method: 'POST', body: JSON.stringify({ status }) }));


    return c.json({ success: true, message: 'Task status updated successfully' });
  } catch (error) {
    return c.json({ success: false, message: 'Error updating task status', error: error.message }, 500);
  }
});

tasks.delete('/:id', async (c) => {
  const taskId = c.req.param('id');
  const developerId = c.get('developerId');

  try {
    const task = await c.env.DB.prepare('SELECT status FROM tasks WHERE id = ? AND developer_id = ?').bind(taskId, developerId).first();

    if (!task) {
      return c.json({ success: false, message: 'Task not found' }, 404);
    }

    if (task.status !== 'created' && task.status !== 'assigned') {
      return c.json({ success: false, message: 'Task cannot be cancelled in its current state' }, 400);
    }

    await c.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(taskId).run();
    await c.env.DB.prepare('DELETE FROM waypoints WHERE task_id = ?').bind(taskId).run();

    return c.json({ success: true, message: 'Task cancelled successfully' });
  } catch (error) {
    return c.json({ success: false, message: 'Error cancelling task', error: error.message }, 500);
  }
});

tasks.get('/:id/realtime', async (c) => {
    const taskId = c.req.param('id');
    const developerId = c.get('developerId');

    // Ensure the task exists and belongs to the developer before upgrading.
    const task = await c.env.DB.prepare('SELECT id FROM tasks WHERE id = ? AND developer_id = ?').bind(taskId, developerId).first();
    if (!task) {
        return c.json({ success: false, message: 'Task not found' }, 404);
    }

    const doId = c.env.TASK_DO.get(c.env.TASK_DO.idFromString(taskId));
    const stub = c.env.TASK_DO.get(doId);

    // Create a new request to the DO with a specific path for websockets
    const url = new URL(c.req.url);
    url.pathname = '/websocket';
    const request = new Request(url.toString(), c.req.raw);
    
    return stub.fetch(request);
});



export default tasks;
