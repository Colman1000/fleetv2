-- Migration number: 0003 	 2024-05-31T12:02:00.000Z
CREATE TABLE riders (
    id TEXT PRIMARY KEY,
    developer_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    vehicle_type TEXT CHECK(vehicle_type IN ('motorcycle', 'bicycle', 'truck_small', 'truck_large', 'car', 'foot')) NOT NULL,
    tags TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (developer_id) REFERENCES developers(id)
);
