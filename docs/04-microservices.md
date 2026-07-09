# 04 — Microservices

Maven multi-module monorepo. Each service is a Spring Boot app in `services/<name>/` with its own
`Dockerfile`, sharing a `shared-lib` module for DTOs, Kafka event schemas, and security filters.

## 4.1 Service catalogue

| Service | Port | Responsibility | Owns |
|---------|:----:|----------------|------|
| **api-gateway** | 8080 | Spring Cloud Gateway. JWT validation, CORS, rate-limit, REST + WebSocket routing | — |
| **auth-service** | 8081 | Users, roles, groups, login, JWT issuance | `users, roles, groups` |
| **call-intake-service** | 8082 | Responder backend: intake queue API, incident creation, ref generation | `incidents` (write path) |
| **incident-service** | 8083 | Incident read model, dispatch queue projection, status transitions | `incidents, incident_assignments` |
| **dispatch-service** | 8084 | Dispatcher backend: READY, take-next, assignment orchestration, ON_ROUTE/ARRIVED | `incident_assignments` |
| **resource-service** | 8085 | Officers, vehicles, skills, stations master data | `officers, vehicles, skills, stations` |
| **geo-query-service** | 8086 | Viewport queries, nearest-trained-resource, clustering | reads Redis GEO + PostGIS |
| **shift-planning-service** | 8087 | Rules-engine roster generation, station balancing | `officer_shifts, shift_patterns` |
| **location-ingest-service** | — | Kafka consumer → Redis GEO + TimescaleDB batch writer | `location_history` |
| **location-simulator-service** | — | Moves on-shift officers along OSRM routes, emits updates | — |
| **call-simulator-service** | — | Generates inbound 999 calls from M25 postcodes | — |
| **crime-simulator-service** | — | Streams crime narrative/assessment for a call | — |
| **routing-service** | 8088 | Thin wrapper over OSRM (routes, ETAs, snap-to-road) | — |
| **frontend** | 3000 | React app, all three persona UIs | — |

> **Consolidation note:** `call-intake` + `incident` could merge, and the two simulators could be
> one module with two profiles. Kept separate in the doc for clarity; [doc 10](./10-delivery-phases.md)
> may fold them to reduce container count on the single Hostinger box.

## 4.2 Kafka topics

| Topic | Key | Partitions | Retention | Producers → Consumers |
|-------|-----|:----------:|-----------|-----------------------|
| `calls.inbound` | postcode | 6 | 1 day | call-simulator → call-intake |
| `calls.crime-stream` | callId | 6 | 1 day | crime-simulator → call-intake (SSE to responder) |
| `incidents.created` | incidentId | 6 | 7 days | call-intake → incident, dispatch |
| `incidents.updated` | incidentId | 6 | 7 days | incident/dispatch → all (status changes) |
| `dispatch.assignments` | incidentId | 6 | 7 days | dispatch → incident, resource, location-sim |
| `locations.updates` | officerId | **32** | 6 hours | location-simulator → location-ingest |
| `locations.deltas` | geohash tile | 16 | 1 hour | location-ingest → geo-query (WS fan-out) |

`locations.updates` is partitioned by `officerId` so each officer's positions stay ordered, and
heavily partitioned (32) to parallelise the 3k/sec load across consumer instances.

## 4.3 Service detail (selected)

### call-simulator-service
- On a Poisson-distributed timer tuned to a **daily demand curve** (peak daytime, trough
  23:00–06:00, Fri/Sat higher), emits a `CallInbound` event:
  `{ callId, phone, addressOrFix, locationSource, accuracyMeters, tsn }`.
- Picks a random `postcode` inside the M25, generates a plausible `address` (or a mobile fix:
  lat/long + accuracy radius). Phone number synthesised.
- Rate scales with a `SIM_INTENSITY` env var so we can dial the queue up/down for demos.
- Produces the **ebbing/flowing intake queue level** the responder sees.

### crime-simulator-service
- For each `callId` picked up by a responder, streams a short sequence of `CrimeDetail` fragments
  (as if the caller is talking): selects a `crime_type` (weighted so petty crime is common, murder
  rare), builds a **narrative description**, sets `injuries/weapons/suspects_on_scene`, and an
  **assessed priority** (from `crime_types.default_priority`, nudged by circumstances).
- Delivered to the responder UI via **SSE/WebSocket** so the assessment panel fills live.

### call-intake-service (Responder backend)
- `GET /api/intake/queue` — current queue level + next call.
- `POST /api/intake/answer` — pull next `CallInbound`, return caller + location fix, open crime
  stream.
- `POST /api/incidents` — responder confirms; creates `incidents` row, generates
  `DDMMYY-NNNNNNN` (via `incident_seq`), publishes `incidents.created`. Returns the reference.

### incident-service (Dispatch queue read model)
- `GET /api/incidents/queue?status=WAITING,ACTIVE` — prioritised, aging list (uses the partial
  index; computes age server-side and streams age ticks over WS).
- Subscribes to `incidents.created` / `dispatch.assignments` to maintain the projection.
- `GET /api/incidents/{ref}` — full detail for the dispatcher's panels.

### dispatch-service (Dispatcher backend)
- `POST /api/dispatch/ready` — dispatcher signals availability; **take-next** pops the
  highest-priority, oldest `WAITING` incident, sets it `ACTIVE`, stamps `activated_at`,
  `dispatched_by`.
- `POST /api/dispatch/{incidentId}/assign` — assign officer(s)+vehicle; creates
  `incident_assignments`, calls `routing-service` for ETA, publishes `dispatch.assignments`,
  flips officer status to `ASSIGNED`→`ON_ROUTE`.
- `POST /api/dispatch/assignment/{id}/arrived` — officer confirms arrival (`ARRIVED`, officer
  `ON_SCENE`). `.../cleared` resolves.

### geo-query-service (the map's data source)
- `POST /api/geo/viewport` `{ bounds, zoom, filters }` → resources visible in the box.
  - **Zoomed out** → returns **clusters** (count + centroid per Supercluster/geohash tile).
  - **Zoomed in** → returns individual resources with type, heading, status, skills badges.
  - Backed by Redis `GEOSEARCH ... BYBOX`; enriched with type/status from a Redis hash.
- `POST /api/geo/nearest` `{ incidentId, requiredSkills[], mode?, limit }` →
  nearest **suitable** on-shift resources. Two-stage: Redis GEO radius candidate set → filter by
  `officer_skills` / `is_firearms` in Postgres → rank by OSRM ETA. Powers **"select nearest
  trained resource."**
- Publishes viewport-scoped deltas to the WS gateway so open maps update live.

### location-ingest-service
See [doc 05](./05-realtime-location-architecture.md). Consumes `locations.updates`, writes Redis
GEO + hash (current), batches inserts to TimescaleDB (history), emits `locations.deltas`.

### routing-service
- `GET /route?from=lon,lat&to=lon,lat&profile=car|bike|foot` → geometry + duration.
- Wraps the OSRM container; caches common routes. Used by the movement simulator, ETAs, and the
  dispatcher's "show route" overlay.

## 4.4 Shared library (`shared-lib`)
- Kafka event POJOs + JSON schemas (versioned).
- JWT filter + `@PreAuthorize` role constants.
- Common `GeoPoint`, `IncidentDto`, `ResourceDto`, error envelope.
- Testcontainers base classes for integration tests.

## 4.5 Inter-service contracts
- **Sync** REST only where a request needs an immediate answer (auth, viewport, nearest,
  incident detail, route).
- **Async** Kafka for everything that is an event/fact (call arrived, incident created, assignment
  made, location moved). This keeps the write paths fast and gives OneAgent a rich async trace map.
