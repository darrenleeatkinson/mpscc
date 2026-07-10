-- Case notes for incidents (text, voice transcription)
CREATE TABLE IF NOT EXISTS incident_notes (
    id          BIGSERIAL    PRIMARY KEY,
    incident_id BIGINT       NOT NULL,
    dispatch_id BIGINT,
    author      TEXT         NOT NULL DEFAULT 'Dispatcher',
    note_text   TEXT         NOT NULL,
    note_type   TEXT         NOT NULL DEFAULT 'TEXT',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_incident_notes_incident ON incident_notes(incident_id, created_at DESC);

-- Persisted OSRM road routes on dispatch_resources
ALTER TABLE dispatch_resources
    ADD COLUMN IF NOT EXISTS route_geojson    JSONB,
    ADD COLUMN IF NOT EXISTS route_distance_m INT,
    ADD COLUMN IF NOT EXISTS route_duration_s INT,
    ADD COLUMN IF NOT EXISTS route_saved_at   TIMESTAMPTZ;
