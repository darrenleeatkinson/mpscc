-- Shared notes table — created here so call-intake-service can write first-contact notes
-- dispatch-service also creates this table with IF NOT EXISTS, so startup order doesn't matter
CREATE TABLE IF NOT EXISTS incident_notes (
    id          BIGSERIAL    PRIMARY KEY,
    incident_id BIGINT       NOT NULL,
    dispatch_id BIGINT,
    author      TEXT         NOT NULL DEFAULT 'System',
    note_text   TEXT         NOT NULL,
    note_type   TEXT         NOT NULL DEFAULT 'TEXT',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_incident_notes_incident ON incident_notes(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_notes_recent   ON incident_notes(created_at DESC);
