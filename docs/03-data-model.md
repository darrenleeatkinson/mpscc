# 03 — Data Model

Two stores hold structured data:

- **PostgreSQL 16 + PostGIS** — all transactional & master data (this document).
- **TimescaleDB** — the append-only `location_history` hypertable (see
  [doc 05](./05-realtime-location-architecture.md)); Redis holds live positions only.

All spatial columns use `geography(Point, 4326)` (WGS-84 lon/lat) with GiST indexes.

## 3.1 Entity-relationship overview

```
 roles ──< user_roles >── users ──< user_groups >── groups
                                   
 stations ──< officers >── skills (via officer_skills)
     │            │
     │            └──< officer_shifts >── shift_patterns
     │            │
     │            └──1:1── vehicle_assignments >── vehicles
     │
 postcodes ──< addresses
                  │
 crime_types ──< incidents >── officers (via incident_assignments)
                  │
                  └── addresses (location), users (created_by responder / dispatcher)
```

## 3.2 Reference & master data

### `postcodes` — the fixed M25 set
The call simulator only ever invents locations inside these. Seeded from a curated set of Greater
London postcode districts (see [doc 11](./11-data-sources-and-seed.md)).

```sql
CREATE TABLE postcodes (
    postcode        TEXT PRIMARY KEY,            -- e.g. 'SW1A 1AA'
    district        TEXT NOT NULL,               -- 'SW1A'
    borough         TEXT NOT NULL,               -- 'Westminster'
    centroid        geography(Point,4326) NOT NULL,
    inside_m25      BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_postcodes_centroid ON postcodes USING GIST (centroid);
```

### `addresses`
```sql
CREATE TABLE addresses (
    id              BIGSERIAL PRIMARY KEY,
    line1           TEXT NOT NULL,
    line2           TEXT,
    town            TEXT,
    postcode        TEXT REFERENCES postcodes(postcode),
    location        geography(Point,4326) NOT NULL,
    location_source TEXT NOT NULL DEFAULT 'LANDLINE'
        CHECK (location_source IN ('LANDLINE','MOBILE_TRIANGULATION','WIFI_GEO','GPS','MANUAL')),
    accuracy_m      INT                          -- radius of uncertainty for mobile fixes
);
CREATE INDEX idx_addresses_location ON addresses USING GIST (location);
```

### `stations` — 110 stations/bases + 3 command centres
```sql
CREATE TABLE stations (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,               -- 'Bow MetCC', 'Brixton Police Station'
    type            TEXT NOT NULL
        CHECK (type IN ('COMMAND_CENTRE','POLICE_STATION','BASE')),
    borough         TEXT,
    address_id      BIGINT REFERENCES addresses(id),
    location        geography(Point,4326) NOT NULL,
    capacity        INT NOT NULL,                -- drives station balancing weight
    size_band       TEXT CHECK (size_band IN ('LARGE','MEDIUM','SMALL'))
);
CREATE INDEX idx_stations_location ON stations USING GIST (location);
```
The three command centres — **Bow, Lambeth, Hendon** — are `COMMAND_CENTRE` rows.

### `skills` and `officer_skills`
```sql
CREATE TABLE skills (
    id       SERIAL PRIMARY KEY,
    code     TEXT UNIQUE NOT NULL,   -- 'FIREARMS','DETECTIVE','SENIOR_DETECTIVE','DOG_HANDLER',
                                     -- 'PUBLIC_ORDER','TRAFFIC','MURDER_INVESTIGATION',
                                     -- 'ADVANCED_DRIVER','MEDICAL_FIRST_AID','NEGOTIATOR', ...
    name     TEXT NOT NULL,
    category TEXT                    -- 'TACTICAL','INVESTIGATIVE','SPECIALIST','DRIVING'
);
CREATE TABLE officer_skills (
    officer_id  BIGINT REFERENCES officers(id),
    skill_id    INT REFERENCES skills(id),
    certified_on DATE,
    expires_on   DATE,
    PRIMARY KEY (officer_id, skill_id)
);
```

### `vehicles` and `vehicle_assignments`
```sql
CREATE TABLE vehicles (
    id            BIGSERIAL PRIMARY KEY,
    type          TEXT NOT NULL
        CHECK (type IN ('CAR','VAN','MOTORBIKE','SCOOTER','PUSHBIKE','DOG_CAR','HORSE')),
    identifier    TEXT UNIQUE NOT NULL,  -- car reg 'LX21 ABC' / asset no 'MB-000123'
    seats         INT NOT NULL,          -- car 2, van up to 10, bike/scooter/horse 1
    home_station  BIGINT REFERENCES stations(id),
    status        TEXT NOT NULL DEFAULT 'AVAILABLE'
        CHECK (status IN ('AVAILABLE','IN_USE','MAINTENANCE'))
);
-- Fleet target: 8000 CAR, 1000 VAN, 500 MOTORBIKE, ~200 SCOOTER, 600 PUSHBIKE,
--               ~60 DOG_CAR, ~30 HORSE  (see doc 06)

CREATE TABLE vehicle_assignments (       -- which on-shift officer currently has which vehicle
    vehicle_id   BIGINT REFERENCES vehicles(id),
    officer_id   BIGINT REFERENCES officers(id),
    shift_id     BIGINT REFERENCES officer_shifts(id),
    assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    released_at  TIMESTAMPTZ,
    PRIMARY KEY (vehicle_id, assigned_at)
);
```

## 3.3 Officers & shifts

### `officers` — 40,000 rows
```sql
CREATE TABLE officers (
    id             BIGSERIAL PRIMARY KEY,
    collar_number  TEXT UNIQUE NOT NULL,        -- warrant/collar id, e.g. 'PC 2456 AB'
    forename       TEXT NOT NULL,
    surname        TEXT NOT NULL,
    rank           TEXT NOT NULL,               -- PC, PS, INSP, DC, DS, DI, ...
    home_station   BIGINT REFERENCES stations(id),
    default_mode   TEXT NOT NULL DEFAULT 'FOOT' -- how they usually deploy
        CHECK (default_mode IN ('FOOT','CAR','VAN','MOTORBIKE','SCOOTER','PUSHBIKE','HORSE','DOG_CAR')),
    is_firearms    BOOLEAN NOT NULL DEFAULT FALSE,  -- fast filter; also in officer_skills
    status         TEXT NOT NULL DEFAULT 'OFF_DUTY'
        CHECK (status IN ('OFF_DUTY','ON_SHIFT','AVAILABLE','ASSIGNED','ON_ROUTE','ON_SCENE','BUSY'))
);
CREATE INDEX idx_officers_station ON officers(home_station);
CREATE INDEX idx_officers_firearms ON officers(is_firearms) WHERE is_firearms;
```

### `shift_patterns` and `officer_shifts`
```sql
CREATE TABLE shift_patterns (
    id           SERIAL PRIMARY KEY,
    code         TEXT UNIQUE,   -- 'EARLY','DAY','LATE','NIGHT'
    start_time   TIME NOT NULL, -- 10-hour shifts, e.g. NIGHT 22:00
    duration_h   INT NOT NULL DEFAULT 10
);
CREATE TABLE officer_shifts (
    id           BIGSERIAL PRIMARY KEY,
    officer_id   BIGINT REFERENCES officers(id),
    pattern_id   INT REFERENCES shift_patterns(id),
    station_id   BIGINT REFERENCES stations(id),  -- where they book on
    shift_date   DATE NOT NULL,
    starts_at    TIMESTAMPTZ NOT NULL,
    ends_at      TIMESTAMPTZ NOT NULL,
    UNIQUE (officer_id, shift_date)
);
CREATE INDEX idx_shifts_window ON officer_shifts(starts_at, ends_at);
```
Roster generation rules live in [doc 06](./06-resource-and-shift-planning.md).

## 3.4 Crime types — the 40

`crime_types` is the seed catalogue. `default_priority` seeds the responder's suggested priority.
Descriptions can be enriched from **met.police.uk** advice pages (see
[doc 11](./11-data-sources-and-seed.md)).

```sql
CREATE TABLE crime_types (
    code             TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    category         TEXT NOT NULL,          -- see bands below
    default_priority INT  NOT NULL CHECK (default_priority BETWEEN 1 AND 5),
    typical_response TEXT,                    -- guidance shown to responder
    description      TEXT
);
```

| # | code | Name | Category | Default P |
|---|------|------|----------|:--:|
| 1 | MURDER | Murder | Serious violence | 1 |
| 2 | ATTEMPTED_MURDER | Attempted murder | Serious violence | 1 |
| 3 | MANSLAUGHTER | Manslaughter | Serious violence | 1 |
| 4 | GBH | Grievous bodily harm (wounding) | Violence | 1 |
| 5 | ABH | Actual bodily harm | Violence | 2 |
| 6 | COMMON_ASSAULT | Common assault | Violence | 3 |
| 7 | RAPE | Rape | Sexual offences | 1 |
| 8 | SEXUAL_ASSAULT | Sexual assault | Sexual offences | 1 |
| 9 | KIDNAP | Kidnapping / false imprisonment | Serious violence | 1 |
| 10 | ARMED_ROBBERY | Robbery (armed) | Robbery | 1 |
| 11 | ROBBERY | Robbery (personal) | Robbery | 2 |
| 12 | AGG_BURGLARY | Aggravated burglary | Burglary | 1 |
| 13 | BURGLARY_DWELLING | Burglary — residential | Burglary | 2 |
| 14 | BURGLARY_COMMERCIAL | Burglary — commercial | Burglary | 3 |
| 15 | FIREARMS_INCIDENT | Firearms discharge / person with gun | Weapons | 1 |
| 16 | KNIFE_CRIME | Knife crime / person with blade | Weapons | 1 |
| 17 | TERRORISM_SUSPECT | Suspected terrorism | Counter-terror | 1 |
| 18 | ARSON | Arson | Criminal damage | 1 |
| 19 | HOSTAGE | Hostage situation | Serious violence | 1 |
| 20 | DOMESTIC_ABUSE | Domestic abuse (in progress) | Violence | 1 |
| 21 | CHILD_ABUSE | Child abuse / safeguarding | Safeguarding | 1 |
| 22 | MISSING_PERSON_HR | Missing person — high risk | Safeguarding | 1 |
| 23 | MISSING_PERSON | Missing person — standard | Safeguarding | 3 |
| 24 | RTC_INJURY | Road traffic collision — injury | Road | 1 |
| 25 | RTC_DAMAGE | Road traffic collision — damage only | Road | 3 |
| 26 | DANGEROUS_DRIVING | Dangerous / careless driving | Road | 2 |
| 27 | DRINK_DRIVING | Driving under influence | Road | 2 |
| 28 | DRUG_DEALING | Drug dealing / supply | Drugs | 3 |
| 29 | DRUG_POSSESSION | Drug possession | Drugs | 4 |
| 30 | ASSAULT_POLICE | Assault on emergency worker | Violence | 2 |
| 31 | PUBLIC_ORDER | Public order / affray | Public order | 2 |
| 32 | DRUNK_DISORDERLY | Drunk and disorderly | Public order | 4 |
| 33 | ASB | Anti-social behaviour | Public order | 4 |
| 34 | THEFT_PERSON | Theft from the person / pickpocketing | Theft | 3 |
| 35 | SHOPLIFTING | Shoplifting | Theft | 4 |
| 36 | VEHICLE_THEFT | Theft of motor vehicle | Theft | 3 |
| 37 | THEFT_FROM_VEHICLE | Theft from motor vehicle | Theft | 4 |
| 38 | CRIMINAL_DAMAGE | Criminal damage / vandalism | Criminal damage | 4 |
| 39 | FRAUD | Fraud | Economic | 5 |
| 40 | HARASSMENT | Harassment / malicious comms | Violence | 4 |

**Priority meaning:**

| P | SLA / meaning | Banner |
|:-:|---------------|--------|
| **1** | Emergency — resource must attend **within 10 minutes** (danger to life, crime in progress, offender at scene) | 🔴 Red |
| **2** | Priority — attend within ~1 hour | 🟠 Amber |
| **3** | Prompt — attend same shift / few hours | 🟡 Yellow |
| **4** | Scheduled — appointment within days | 🔵 Blue |
| **5** | Resolution without deployment / follow-up (e.g. fraud referral) | ⚪ Grey |

## 3.5 Incidents

### Incident reference — `DDMMYY-NNNNNNN`
- `DDMMYY` = date the incident was created.
- `NNNNNNN` = 7-digit sequence **starting at 10000**, from a Postgres sequence.
- Example: `040726-0010042`.

```sql
CREATE SEQUENCE incident_seq START 10000;

CREATE TABLE incidents (
    id              BIGSERIAL PRIMARY KEY,
    reference       TEXT UNIQUE NOT NULL,        -- 'DDMMYY-NNNNNNN'
    crime_code      TEXT REFERENCES crime_types(code),
    priority        INT NOT NULL CHECK (priority BETWEEN 1 AND 5),
    status          TEXT NOT NULL DEFAULT 'WAITING'
        CHECK (status IN ('INTAKE','WAITING','ACTIVE','ASSIGNED','ON_SCENE','RESOLVED','CANCELLED')),
    -- caller / location
    caller_name     TEXT,
    caller_phone    TEXT,                        -- known from BT
    address_id      BIGINT REFERENCES addresses(id),
    location        geography(Point,4326) NOT NULL,
    -- assessment (streamed by crime-simulator, confirmed by responder)
    title           TEXT NOT NULL,
    description     TEXT,
    injuries        BOOLEAN DEFAULT FALSE,
    weapons_present BOOLEAN DEFAULT FALSE,
    suspects_on_scene BOOLEAN DEFAULT FALSE,
    people_at_risk  INT DEFAULT 0,
    -- people / audit
    created_by      BIGINT REFERENCES users(id), -- responder
    dispatched_by   BIGINT REFERENCES users(id), -- dispatcher who took it
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at    TIMESTAMPTZ,                 -- when dispatcher went READY on it
    resolved_at     TIMESTAMPTZ
);
CREATE INDEX idx_incidents_location  ON incidents USING GIST (location);
CREATE INDEX idx_incidents_queue     ON incidents (priority, created_at)
    WHERE status IN ('WAITING','ACTIVE','ASSIGNED','ON_SCENE');
```
The partial `idx_incidents_queue` makes the dispatcher's "prioritised, aging queue" query cheap.

### Incident assignments (state machine)
```sql
CREATE TABLE incident_assignments (
    id           BIGSERIAL PRIMARY KEY,
    incident_id  BIGINT REFERENCES incidents(id),
    officer_id   BIGINT REFERENCES officers(id),
    vehicle_id   BIGINT REFERENCES vehicles(id),
    state        TEXT NOT NULL DEFAULT 'ASSIGNED'
        CHECK (state IN ('ASSIGNED','ON_ROUTE','ARRIVED','CLEARED','STOOD_DOWN')),
    assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    enroute_at   TIMESTAMPTZ,
    arrived_at   TIMESTAMPTZ,
    cleared_at   TIMESTAMPTZ,
    eta_seconds  INT                            -- from OSRM at assignment time
);
CREATE INDEX idx_assign_incident ON incident_assignments(incident_id);
CREATE INDEX idx_assign_officer  ON incident_assignments(officer_id);
```

State flow: `ASSIGNED → ON_ROUTE → ARRIVED → CLEARED` (or `STOOD_DOWN`). The officer's own
`status` mirrors this (`ASSIGNED/ON_ROUTE/ON_SCENE/AVAILABLE`).

## 3.6 Users, roles, groups
See [doc 08](./08-security-rbac.md) for the full RBAC model; tables summarised here:

```sql
CREATE TABLE users  (id BIGSERIAL PRIMARY KEY, username TEXT UNIQUE, display_name TEXT,
                     password_hash TEXT, station_id BIGINT REFERENCES stations(id),
                     enabled BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE roles  (id SERIAL PRIMARY KEY, code TEXT UNIQUE);   -- RESPONDER,DISPATCHER,PLANNER,ADMIN
CREATE TABLE groups (id SERIAL PRIMARY KEY, code TEXT UNIQUE, description TEXT);
CREATE TABLE user_roles  (user_id BIGINT, role_id INT,  PRIMARY KEY(user_id,role_id));
CREATE TABLE user_groups (user_id BIGINT, group_id INT, PRIMARY KEY(user_id,group_id));
```

## 3.7 Data volumes (seeded)

| Table | Rows |
|-------|------|
| postcodes | ~5,000 (M25 districts) |
| addresses | grows as calls arrive (+ ~10k seed) |
| stations | 113 (110 + 3 command centres) |
| skills | ~15 |
| officers | 40,000 |
| officer_skills | ~120,000 (avg 3 each; 6,000 with FIREARMS) |
| vehicles | ~10,390 |
| shift_patterns | 4 |
| officer_shifts | ~280,000 / week |
| crime_types | 40 |
| incidents | grows continuously (simulated) |
| location_history (TimescaleDB) | millions/day — see doc 05 |
