-- Migration number: 0004 	 2024-05-31T12:03:00.000Z
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    developer_id TEXT NOT NULL,
    description TEXT NOT NULL,
    auto_assign BOOLEAN NOT NULL,
    metadata TEXT,
    pickup_lat REAL NOT NULL,
    pickup_lng REAL NOT NULL,
    pickup_address TEXT NOT NULL,
    destination_lat REAL NOT NULL,
    destination_lng REAL NOT NULL,
    destination_address TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    status TEXT CHECK(status IN ('created', 'assigned', 'accepted', 'en_route', 'arrived', 'completed', 'cancelled', 'assignment_failed')) NOT NULL,
    FOREIGN KEY (developer_id) REFERENCES developers(id)
);
