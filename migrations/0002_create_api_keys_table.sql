-- Migration number: 0002 	 2024-05-31T12:01:00.000Z
CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    developer_id TEXT NOT NULL,
    prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    scopes TEXT NOT NULL,
    expires_at INTEGER,
    FOREIGN KEY (developer_id) REFERENCES developers(id)
);
