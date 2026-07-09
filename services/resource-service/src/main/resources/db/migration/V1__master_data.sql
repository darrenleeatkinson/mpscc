-- ============================================================
-- MPSCC master & reference data schema (Phase 1)
-- Owned by resource-service. PostGIS geography(Point,4326).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------- postcodes (fixed M25 set) ----------
CREATE TABLE IF NOT EXISTS postcodes (
    postcode    TEXT PRIMARY KEY,
    district    TEXT NOT NULL,
    borough     TEXT NOT NULL,
    centroid    geography(Point,4326) NOT NULL,
    inside_m25  BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_postcodes_centroid ON postcodes USING GIST (centroid);

-- ---------- addresses ----------
CREATE TABLE IF NOT EXISTS addresses (
    id              BIGSERIAL PRIMARY KEY,
    line1           TEXT NOT NULL,
    line2           TEXT,
    town            TEXT,
    postcode        TEXT REFERENCES postcodes(postcode),
    location        geography(Point,4326) NOT NULL,
    location_source TEXT NOT NULL DEFAULT 'LANDLINE',
    accuracy_m      INT
);
CREATE INDEX IF NOT EXISTS idx_addresses_location ON addresses USING GIST (location);

-- ---------- stations (110 + 3 command centres) ----------
CREATE TABLE IF NOT EXISTS stations (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL,          -- COMMAND_CENTRE | POLICE_STATION | BASE
    borough     TEXT,
    location    geography(Point,4326) NOT NULL,
    capacity    INT NOT NULL,
    size_band   TEXT                     -- LARGE | MEDIUM | SMALL
);
CREATE INDEX IF NOT EXISTS idx_stations_location ON stations USING GIST (location);

-- ---------- skills ----------
CREATE TABLE IF NOT EXISTS skills (
    id       SERIAL PRIMARY KEY,
    code     TEXT UNIQUE NOT NULL,
    name     TEXT NOT NULL,
    category TEXT
);

-- ---------- vehicles ----------
CREATE TABLE IF NOT EXISTS vehicles (
    id            BIGSERIAL PRIMARY KEY,
    type          TEXT NOT NULL,        -- CAR|VAN|MOTORBIKE|SCOOTER|PUSHBIKE|DOG_CAR|HORSE
    identifier    TEXT UNIQUE NOT NULL,
    seats         INT NOT NULL,
    home_station  BIGINT REFERENCES stations(id),
    status        TEXT NOT NULL DEFAULT 'AVAILABLE'
);
CREATE INDEX IF NOT EXISTS idx_vehicles_station ON vehicles(home_station);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(type);

-- ---------- officers (40,000) ----------
CREATE TABLE IF NOT EXISTS officers (
    id             BIGSERIAL PRIMARY KEY,
    collar_number  TEXT UNIQUE NOT NULL,
    forename       TEXT NOT NULL,
    surname        TEXT NOT NULL,
    rank           TEXT NOT NULL,
    home_station   BIGINT REFERENCES stations(id),
    default_mode   TEXT NOT NULL DEFAULT 'FOOT',
    is_firearms    BOOLEAN NOT NULL DEFAULT FALSE,
    status         TEXT NOT NULL DEFAULT 'OFF_DUTY'
);
CREATE INDEX IF NOT EXISTS idx_officers_station ON officers(home_station);
CREATE INDEX IF NOT EXISTS idx_officers_firearms ON officers(is_firearms) WHERE is_firearms;

-- ---------- officer_skills ----------
CREATE TABLE IF NOT EXISTS officer_skills (
    officer_id   BIGINT REFERENCES officers(id),
    skill_id     INT REFERENCES skills(id),
    certified_on DATE,
    expires_on   DATE,
    PRIMARY KEY (officer_id, skill_id)
);

-- ---------- shift patterns & shifts ----------
CREATE TABLE IF NOT EXISTS shift_patterns (
    id           SERIAL PRIMARY KEY,
    code         TEXT UNIQUE,
    start_time   TIME NOT NULL,
    duration_h   INT NOT NULL DEFAULT 10
);
CREATE TABLE IF NOT EXISTS officer_shifts (
    id           BIGSERIAL PRIMARY KEY,
    officer_id   BIGINT REFERENCES officers(id),
    pattern_id   INT REFERENCES shift_patterns(id),
    station_id   BIGINT REFERENCES stations(id),
    shift_date   DATE NOT NULL,
    starts_at    TIMESTAMPTZ NOT NULL,
    ends_at      TIMESTAMPTZ NOT NULL,
    UNIQUE (officer_id, shift_date)
);
CREATE INDEX IF NOT EXISTS idx_shifts_window ON officer_shifts(starts_at, ends_at);

CREATE TABLE IF NOT EXISTS vehicle_assignments (
    vehicle_id   BIGINT REFERENCES vehicles(id),
    officer_id   BIGINT REFERENCES officers(id),
    shift_id     BIGINT REFERENCES officer_shifts(id),
    assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    released_at  TIMESTAMPTZ,
    PRIMARY KEY (vehicle_id, assigned_at)
);

-- ---------- crime types (catalogue of 40) ----------
CREATE TABLE IF NOT EXISTS crime_types (
    code             TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    category         TEXT NOT NULL,
    default_priority INT  NOT NULL CHECK (default_priority BETWEEN 1 AND 5),
    typical_response TEXT,
    description      TEXT
);

-- seed marker so seeding is idempotent
CREATE TABLE IF NOT EXISTS seed_marker (
    name       TEXT PRIMARY KEY,
    seeded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    row_count  BIGINT
);
