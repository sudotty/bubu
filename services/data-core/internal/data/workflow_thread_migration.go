package data

const workflowThreadBindingMigrationSQL = `
ALTER TABLE workflow_definitions
ADD COLUMN thread_id TEXT REFERENCES conversation_threads(id) ON DELETE SET NULL;

UPDATE workflow_definitions
SET thread_id = (
    SELECT threads.id
    FROM conversation_threads threads
    WHERE threads.target_kind = workflow_definitions.target_kind
      AND threads.target_id = workflow_definitions.target_id
    ORDER BY CASE WHEN threads.archived_at IS NULL THEN 0 ELSE 1 END,
             threads.updated_at DESC,
             threads.id DESC
    LIMIT 1
);

UPDATE workflow_definitions
SET deleted_at = COALESCE(deleted_at, updated_at)
WHERE thread_id IS NULL;

CREATE INDEX workflow_definitions_thread_idx
ON workflow_definitions(thread_id, updated_at DESC);
`
