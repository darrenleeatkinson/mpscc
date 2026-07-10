-- Add live-position tracking and transport mode to dispatched resources
ALTER TABLE dispatch_resources
    ADD COLUMN current_lat  DOUBLE PRECISION,
    ADD COLUMN current_lon  DOUBLE PRECISION,
    ADD COLUMN target_lat   DOUBLE PRECISION,
    ADD COLUMN target_lon   DOUBLE PRECISION,
    ADD COLUMN mode         TEXT DEFAULT 'FOOT';

CREATE INDEX idx_dr_current_pos ON dispatch_resources(dispatch_id)
    WHERE current_lat IS NOT NULL;
