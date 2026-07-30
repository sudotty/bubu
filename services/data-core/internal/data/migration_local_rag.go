package data

const localRAGMigrationSQL = `
CREATE TABLE knowledge_sources (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 200),
    kind TEXT NOT NULL CHECK (kind IN ('text', 'markdown', 'pdf')),
    current_version_id TEXT UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE knowledge_source_versions (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL CHECK (ordinal > 0),
    source_bytes INTEGER NOT NULL CHECK (source_bytes BETWEEN 1 AND 20971520),
    source_sha256 TEXT NOT NULL CHECK (length(source_sha256) = 64),
    raw_text TEXT NOT NULL CHECK (length(raw_text) BETWEEN 1 AND 8388608),
    chunk_count INTEGER NOT NULL CHECK (chunk_count BETWEEN 1 AND 2000),
    imported_at TEXT NOT NULL,
    UNIQUE (source_id, ordinal)
);

CREATE TABLE knowledge_chunks (
    id TEXT PRIMARY KEY,
    version_id TEXT NOT NULL REFERENCES knowledge_source_versions(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 1999),
    start_line INTEGER NOT NULL CHECK (start_line > 0),
    end_line INTEGER NOT NULL CHECK (end_line >= start_line),
    text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 8000),
    UNIQUE (version_id, ordinal)
);

CREATE INDEX knowledge_source_versions_source_idx ON knowledge_source_versions(source_id, ordinal DESC);
CREATE INDEX knowledge_chunks_version_idx ON knowledge_chunks(version_id, ordinal);

CREATE VIRTUAL TABLE knowledge_chunks_fts USING fts5(
    text,
    content='knowledge_chunks',
    content_rowid='rowid',
    tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER knowledge_chunks_after_insert AFTER INSERT ON knowledge_chunks BEGIN
    INSERT INTO knowledge_chunks_fts(rowid, text) VALUES (new.rowid, new.text);
END;
CREATE TRIGGER knowledge_chunks_after_delete AFTER DELETE ON knowledge_chunks BEGIN
    INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
END;
CREATE TRIGGER knowledge_chunks_after_update AFTER UPDATE ON knowledge_chunks BEGIN
    INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
    INSERT INTO knowledge_chunks_fts(rowid, text) VALUES (new.rowid, new.text);
END;
`
