import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../auth';
import { createRiderSchema, updatePresenceSchema, updateLocationSchema, getAvailableRidersSchema } from './schema';
import { Env } from '../types';
import { getDistance } from '../utils/geometry';

const riders = new Hono<Env>();

riders.use('*', authMiddleware);

riders.post('/', zValidator('json', createRiderSchema), async (c) => {
    const riderData = c.req.valid('json');
    const developerId = c.get('developerId');

    try {
        const result = await c.env.DB.prepare(
            'INSERT INTO riders (developer_id, name, phone, email, vehicle_type, tags) VALUES (?, ?, ?, ?, ?, ?)'
        )
            .bind(
                developerId,
                riderData.name,
                riderData.phone,
                riderData.email,
                riderData.vehicle_type,
                JSON.stringify(riderData.tags)
            )
            .run();

        return c.json({ success: true, message: 'Rider created successfully', data: riderData });
    } catch (error) {
        return c.json({ success: false, message: 'Error creating rider', error: error.message }, 500);
    }
});

riders.get('/available', zValidator('query', getAvailableRidersSchema), async (c) => {
    const { lat, lng, radius, vehicle_type, tags } = c.req.valid('query');
    const developerId = c.get('developerId');

    // 1. Get all riders for the developer
    let query = 'SELECT * FROM riders WHERE developer_id = ?';
    const params = [developerId];
    if (vehicle_type) {
        query += ' AND vehicle_type = ?';
        params.push(vehicle_type);
    }
    if (tags) {
        query += ' AND json_contains(tags, ?)';
        params.push(JSON.stringify(tags.split(',')));
    }
    const { results: allRiders } = await c.env.DB.prepare(query).bind(...params).all();

    // 2. Filter by presence and location in parallel
    const availableRiders = [];
    await Promise.all(allRiders.map(async (rider) => {
        const doId = c.env.RIDER_DO.idFromName(rider.id.toString());
        const stub = c.env.RIDER_DO.get(doId);
        const res = await stub.fetch('https://do/location');
        if (res.status === 200) {
            const riderState = await res.json();
            if (riderState.presence === 'available' && riderState.location) {
                 const distance = getDistance(lat, lng, riderState.location.latitude, riderState.location.longitude);
                 if (distance <= radius) {
                    availableRiders.push({ ...rider, distance, location: riderState.location });
                 }
            }
        }
    }));
    
    // 3. Sort by distance
    availableRiders.sort((a, b) => a.distance - b.distance);

    return c.json({ success: true, data: availableRiders });
});


riders.patch('/:id/presence', zValidator('json', updatePresenceSchema), async (c) => {
    const riderId = c.req.param('id');
    const doId = c.env.RIDER_DO.idFromName(riderId);
    const stub = c.env.RIDER_DO.get(doId);
    return stub.fetch(c.req.raw);
});

riders.patch('/:id/location', zValidator('json', updateLocationSchema), async (c) => {
    const riderId = c.req.param('id');
    const doId = c.env.RIDER_DO.idFromName(riderId);
    const stub = c.env.RIDER_DO.get(doId);
    return stub.fetch(c.req.raw);
});

riders.get('/:id/ws', async (c) => {
    const riderId = c.req.param('id');
    const doId = c.env.RIDER_DO.idFromName(riderId);
    const stub = c.env.RIDER_DO.get(doId);
    const url = new URL(c.req.url);
    url.pathname += '/websocket';
    const request = new Request(url.toString(), c.req.raw);
    return stub.fetch(request);
});

export default riders;
