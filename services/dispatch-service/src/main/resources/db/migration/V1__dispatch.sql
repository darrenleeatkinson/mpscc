-- Dispatch assignments
CREATE TABLE dispatches (
    id           BIGSERIAL    PRIMARY KEY,
    incident_id  BIGINT       NOT NULL,
    incident_ref TEXT         NOT NULL,
    priority     INT          NOT NULL,
    status       TEXT         NOT NULL DEFAULT 'ACTIVE',
    created_at   TIMESTAMPTZ  NOT NULL,
    on_scene_at  TIMESTAMPTZ,
    resolved_at  TIMESTAMPTZ
);

CREATE INDEX idx_dispatches_status      ON dispatches(status);
CREATE INDEX idx_dispatches_incident_id ON dispatches(incident_id);

-- Individual resources assigned to a dispatch
CREATE TABLE dispatch_resources (
    id            BIGSERIAL    PRIMARY KEY,
    dispatch_id   BIGINT       NOT NULL REFERENCES dispatches(id),
    resource_type TEXT         NOT NULL,  -- OFFICER | VEHICLE
    resource_id   BIGINT       NOT NULL,
    resource_ref  TEXT         NOT NULL,  -- collar_number or vehicle identifier
    resource_name TEXT,                   -- officer full name or vehicle type
    assigned_at   TIMESTAMPTZ  NOT NULL
);

CREATE INDEX idx_dispatch_resources_dispatch ON dispatch_resources(dispatch_id);
