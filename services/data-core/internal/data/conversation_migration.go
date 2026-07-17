package data

const conversationInsightMigrationSQL = `
ALTER TABLE conversation_entries RENAME TO conversation_entries_v10;

CREATE TABLE conversation_entries (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES conversation_threads(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL CHECK (ordinal > 0),
    kind TEXT NOT NULL CHECK (kind IN ('question', 'plan', 'result', 'insight', 'error')),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (thread_id, ordinal),
    CHECK (
        (kind = 'question' AND role = 'user') OR
        (kind IN ('plan', 'result', 'insight') AND role = 'assistant') OR
        (kind = 'error' AND role = 'system')
    )
);

INSERT INTO conversation_entries(
    id, thread_id, ordinal, kind, role, payload_json, created_at
)
SELECT id, thread_id, ordinal, kind, role, payload_json, created_at
FROM conversation_entries_v10;

DROP TABLE conversation_entries_v10;

CREATE INDEX conversation_entries_thread_id_idx
ON conversation_entries(thread_id, ordinal);
`
