-- Migration number: 0001 	 2024-05-31T12:00:00.000Z
CREATE TABLE developers (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
