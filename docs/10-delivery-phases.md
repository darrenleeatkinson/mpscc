# 10 — Delivery Phases

Split so each phase is independently shippable, testable, and **token-safe to build** (no phase
requires one giant code generation). Each phase ends **green on Hostinger** before the next starts.
Within a phase, large modules are built one at a time.

## Phase 0 — Foundations (repo + pipeline green)
**Goal:** an empty-but-deployable skeleton.
- New GitHub repo `mpscc`, monorepo skeleton, parent `pom.xml`.
- `docker-compose.yml` with infra only: Postgres+PostGIS, TimescaleDB, Redis, Kafka, OSRM.
- `api-gateway` + `auth-service` (login, JWT, seeded demo users) + minimal React shell with
  persona switcher and login.
- `.github/workflows/deploy.yml` + `rollback.yml` adapted from `payments`; secrets set.
- **Exit:** push to main auto-deploys; you can log in as each role on `srv970497.hstgr.cloud`.

## Phase 1 — Master data & seed
**Goal:** the world exists.
- Schema migrations (Flyway) for all Postgres tables (doc 03) + TimescaleDB hypertable.
- Seeders: postcodes (M25), 113 stations, 40 crime types, skills, **40,000 officers**, ~10,390
  vehicles, skills distribution (6,000 firearms).
- `resource-service` read APIs (officers, stations, vehicles, skills).
- **Exit:** APIs return the seeded world; counts match doc 03.

## Phase 2 — Call intake & responder
**Goal:** Persona 1 works end-to-end.
- `call-simulator-service` (intake queue, demand curve) → `calls.inbound`.
- `crime-simulator-service` → crime stream.
- `call-intake-service`: answer, capture, create incident, `DDMMYY-NNNNNNN`, publish
  `incidents.created`.
- Responder React console (doc 07 §7.3) with live queue gauge + assessment stream.
- **Exit:** answering a call and creating an incident produces a referenced Postgres row.

## Phase 3 — Incident queue & dispatcher (no live map yet)
**Goal:** Persona 2 core loop.
- `incident-service` dispatch-queue projection (priority+age, live age ticks over WS).
- `dispatch-service`: READY / take-next / assign / ON_ROUTE / ARRIVED / resolve state machine.
- Dispatcher console with prioritised aging queue + coloured banners + incident detail panels
  (map stubbed with a static tile for now).
- **Exit:** dispatcher can go READY, take the next incident, assign a (static) resource, walk the
  state machine; timeline logs it.

## Phase 4 — Live location backbone
**Goal:** officers move and are stored correctly at scale.
- `routing-service` over OSRM (London extract pre-processed).
- `location-simulator-service`: sharded, moves on-shift officers along routes, 5s ticks →
  `locations.updates`.
- `location-ingest-service`: → Redis GEO + hash (live) and batched TimescaleDB inserts (history)
  + `locations.deltas`.
- **Exit:** Redis shows ~thousands of live positions; TimescaleDB accrues history; a point-in-time
  and full-journey query both return correct paths. Load-tested toward 3k/sec.

## Phase 5 — The map (dispatcher, live)
**Goal:** the showcase screen.
- MapLibre GL map centred on active incident; viewport WS subscription; `geo-query-service`
  viewport + clustering; zoom-dependent typed icons; stations/command centres; recentre button.
- **Nearest trained resource** + **drag-and-drop assign** wired to `dispatch-service`; route
  overlay + live ETA countdown; ON_ROUTE animation from live positions; ARRIVED confirmation.
- **Exit:** full dispatch-on-a-live-map loop, smooth at 60 fps with thousands of officers moving.

## Phase 6 — Resource & shift planner
**Goal:** Persona 3.
- `shift-planning-service` rules engine (doc 06): demand model, constraints, roster generation,
  coverage report; firearms cover; fleet allocation.
- Planner console: roster grid, coverage heatmap, station balance, skills/firearms cover, fleet
  utilisation; rules tuning + regenerate.
- **Exit:** generate a week's roster for 40,000 officers honouring demand + constraints; on-shift
  set feeds the movement simulator.

## Phase 7 — Polish, RBAC scoping, observability, hardening
- Group-based data scoping (doc 08), audit/journey playback UI (replay an officer's day),
  Dynatrace RUM + dashboards, performance tuning, empty/error/loading states, accessibility pass,
  demo script + seeded scenario ("P1 firearms incident in Westminster").
- **Exit:** demo-ready, observable, resilient.

## Sequencing rules
- Infra and pipeline (Phase 0) before features.
- Each service PR is small and independently deployable (change-detection redeploys just it).
- Large seeders and the map are the two riskiest chunks — built and load-tested in isolation
  (Phases 1 & 4/5).
- Simulators can run at low `SIM_INTENSITY` early, scaled up once ingest is proven.
