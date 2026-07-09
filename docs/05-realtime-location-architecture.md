# 05 — Real-Time Location Architecture

This is the heart of the platform and its biggest engineering risk. It has three jobs:

1. **Move** up to ~15,000 on-shift officers realistically along London streets.
2. **Ingest** their positions (up to ~3,000/sec, 20k burst) without melting Postgres.
3. **Show** the right subset live on each dispatcher's map at 60 fps — and let anyone **audit any
   officer's full journey** at any past moment.

## 5.1 The data-flow

```
 location-simulator ──▶ Kafka: locations.updates (key=officerId, 32 partitions)
                              │
                              ▼
                     location-ingest (consumer group, N instances)
                        │          │              │
        GEOADD/HSET     │          │ multi-row    │ emit tile delta
        (current pos)   ▼          ▼ INSERT       ▼
                   ┌─────────┐  ┌──────────────┐  Kafka: locations.deltas
                   │ Redis 7 │  │ TimescaleDB  │        │
                   │  GEO +  │  │ location_    │        ▼
                   │  hash   │  │ history      │   WS gateway ──▶ browsers
                   └────┬────┘  │ (hypertable) │   (only viewport-matched)
                        │       └──────────────┘
              GEOSEARCH │
                        ▼
                  geo-query-service ──▶ viewport / nearest queries
```

Three stores, three jobs — **never** the same store for two jobs:

| Store | Holds | Access pattern |
|-------|-------|----------------|
| **Redis GEO** | *Current* position + status of every on-shift officer | write 3k/s, read by bounding box, sub-ms |
| **TimescaleDB** | *Every* position ever, append-only | batch write 3k/s, time-range read for audit |
| **PostgreSQL** | Officer master data, skills, assignments | transactional, low rate |

## 5.2 Redis — live state

- `GEOADD officers:live <lon> <lat> <officerId>` on each update (O(log N)).
- `HSET officer:<id> mode CAR status ON_ROUTE heading 210 speed 34 incident <ref>` for the
  render-time attributes (mode → icon, status → colour).
- Viewport read: `GEOSEARCH officers:live FROMLONLAT <cx> <cy> BYBOX <w> <h> m ASC COUNT 500` →
  candidate ids, then `HMGET` the attributes.
- Nearest-resource read: `GEOSEARCH ... BYRADIUS <r> m ASC` → candidates, filtered by skill in
  Postgres, ranked by OSRM ETA.
- TTL/heartbeat: an officer missing updates for >30 s is greyed as `STALE`.

Redis holds ~15k small entries — a few MB. Trivially fits in memory and is shared across all
containers (it *is* the cross-container cache the brief asked for).

## 5.3 TimescaleDB — history & audit

```sql
CREATE TABLE location_history (
    officer_id   BIGINT       NOT NULL,
    ts           TIMESTAMPTZ  NOT NULL,
    location     geography(Point,4326) NOT NULL,
    mode         TEXT,
    speed_kmh    REAL,
    heading      SMALLINT,
    incident_id  BIGINT,
    shift_id     BIGINT
);
SELECT create_hypertable('location_history', 'ts', chunk_time_interval => INTERVAL '1 hour');
CREATE INDEX ON location_history (officer_id, ts DESC);
SELECT add_compression_policy('location_history', INTERVAL '2 hours');
```

- **Ingest** is batched: the consumer buffers ~1–2 s or 5,000 rows and does one multi-row
  `INSERT` (or `COPY`). At 3k/s that's ~2 batches/sec — Timescale eats this easily.
- **Compression** kicks in after 2 hours (segment by `officer_id`, order by `ts`) → 10–20×
  smaller; months of trails stay cheap.
- **Point-in-time** ("where was officer 4521 at 14:32:05 last Tuesday?"):
  ```sql
  SELECT * FROM location_history
   WHERE officer_id = 4521 AND ts <= '2026-06-30 14:32:05Z'
   ORDER BY ts DESC LIMIT 1;
  ```
- **Full journey** (audit): `WHERE officer_id = 4521 AND ts BETWEEN shift_start AND shift_end
  ORDER BY ts` → returns the ordered breadcrumb; the frontend draws the path on the map.
- **Why not Postgres proper:** 3k inserts/sec into a normal table bloats indexes and fights the
  transactional workload. The hypertable isolates it, compresses it, and keeps it SQL-queryable.
  *(Escape hatch: swap to QuestDB if ingest ever dominates — same append-only contract.)*

## 5.4 The movement simulator

Makes officers move like real people/vehicles, not teleport.

- **Who moves:** every officer whose current `officer_shift` window is open. Station-bound
  officers (front desk, custody) mostly stay put with small jitter; patrol officers roam.
- **How they move:** each roaming officer holds a **current route** (an OSRM polyline). When they
  finish a route, the simulator picks a new nearby destination (patrol beat within their station's
  borough) and fetches a fresh route from `routing-service`.
- **Speed by mode** (drawn per tick, London-realistic):

  | Mode | Speed distribution |
  |------|--------------------|
  | FOOT | ~5 mph (8 km/h), small variance |
  | PUSHBIKE | 8–15 mph |
  | SCOOTER / MOTORBIKE | 10–35 mph, filters traffic |
  | CAR / DOG_CAR / VAN | 5–80 mph, **heavily weighted to 15–25 mph** (London congestion); random "held in traffic" stalls |
  | HORSE | ~4–8 mph |

- **On assignment:** when `dispatch.assignments` arrives, the officer's route is **replaced** with
  the OSRM route to the incident; status → `ON_ROUTE`; on reaching the end it auto-confirms
  `ARRIVED` (or waits for the simulated mobile confirmation).
- **Tick:** every **5 seconds** the simulator advances each moving officer along its polyline by
  `speed × 5s`, computes new lat/long + heading, and emits a `LocationUpdate` to
  `locations.updates`.
- **Sharding:** the simulator runs as **partitioned workers** (e.g. by officer-id modulo N) so the
  15k-officer tick fans out; each worker emits its slice. This is what generates the 3k/sec.

## 5.5 Viewport streaming — why the browser survives

The platform **never** streams 3k/sec to a browser. Instead:

1. The map component publishes its **bounds + zoom** to the WS gateway whenever the user pans/zooms
   (debounced ~250 ms) → topic `locations.viewport-req`.
2. `geo-query-service` translates bounds into a Redis `GEOSEARCH BYBOX` and returns the current
   snapshot (individual resources, or **clusters** if zoom < threshold).
3. For live motion, the gateway forwards only `locations.deltas` whose **geohash tile intersects
   the client's viewport**. A dispatcher watching one neighbourhood gets tens–hundreds of deltas/s,
   not thousands.
4. **Zoom-dependent detail:** below zoom Z the map shows cluster bubbles (counts); at/above Z it
   shows typed icons (foot/car/van/bike/horse/dog) coloured by status, with heading rotation.
   Stations/command-centre icons appear at their own zoom threshold.

This bounds client load to *what is visible*, independent of the 40k fleet size — the single most
important scalability decision in the platform.

## 5.6 Failure & correctness notes
- **Ordering:** per-officer ordering guaranteed by Kafka key = officerId.
- **At-least-once:** ingest is idempotent — `GEOADD` overwrites, and history rows are naturally
  append (dupes filtered by `(officer_id, ts)` if needed).
- **Backpressure:** if ingest lags, Redis (live view) is updated first and cheaply; Timescale
  batches can grow without affecting the live map.
- **Replay/audit integrity:** because `locations.updates` retains 6 h and Timescale keeps forever,
  a lost consumer can be replayed to reconstruct history.
