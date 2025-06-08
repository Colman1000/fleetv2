-- Migration number: 0005 	 2024-05-31T12:04:00.000Z
CREATE TABLE waypoints (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    address TEXT NOT NULL,
    type TEXT CHECK(type IN ('pickup', 'stop', 'destination')) NOT NULL,
    description TEXT,
    time_window_start INTEGER,
    time_window_end INTEGER,
    priority TEXT,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);
