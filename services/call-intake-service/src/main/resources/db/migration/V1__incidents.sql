CREATE SEQUENCE IF NOT EXISTS incident_seq START 1;

CREATE TABLE IF NOT EXISTS incidents (
    id            BIGSERIAL    PRIMARY KEY,
    reference     VARCHAR(14)  NOT NULL UNIQUE,
    status        VARCHAR(20)  NOT NULL DEFAULT 'WAITING',
    priority      INT          NOT NULL DEFAULT 3,
    call_id       VARCHAR(36),
    caller_phone  VARCHAR(25),
    caller_name   VARCHAR(100),
    address       TEXT,
    postcode      VARCHAR(10),
    latitude      DOUBLE PRECISION,
    longitude     DOUBLE PRECISION,
    crime_type    VARCHAR(50),
    crime_description TEXT,
    injuries           BOOLEAN NOT NULL DEFAULT FALSE,
    weapons            BOOLEAN NOT NULL DEFAULT FALSE,
    suspects_on_scene  BOOLEAN NOT NULL DEFAULT FALSE,
    people_at_risk     INT     NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_status_prio
    ON incidents (status, priority, created_at);
