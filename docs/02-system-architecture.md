# 02 — System Architecture

## 2.1 Container / topology diagram

```
                                   ┌───────────────────────────────┐
                                   │            BROWSER             │
                                   │  React 18 + MapLibre GL + TS   │
                                   │  Responder │ Dispatch │ Planner│
                                   └───────┬───────────────┬────────┘
                                    HTTPS  │           WSS │ (STOMP, viewport subs)
                                           ▼               ▼
                          ┌────────────────────────────────────────────┐
                          │  API GATEWAY  (Spring Cloud Gateway :8080)   │
                          │  JWT filter · CORS · rate-limit · WS proxy   │
                          └──┬────┬────┬────┬────┬────┬────┬────┬────┬───┘
      ┌──────────────────────┘    │    │    │    │    │    │    │    └────────────────┐
      ▼                           ▼    ▼    ▼    ▼    ▼    ▼    ▼                     ▼
 ┌─────────┐  ┌────────────┐ ┌────────┐ ┌────────┐ ┌────────────┐ ┌───────────┐ ┌──────────┐
 │ auth-   │  │ call-intake│ │incident│ │dispatch│ │ resource-  │ │ geo-query │ │ shift-   │
 │ service │  │ -service   │ │-service│ │-service│ │ service    │ │ -service  │ │ planning │
 │ :8081   │  │ :8082      │ │ :8083  │ │ :8084  │ │ :8085      │ │ :8086     │ │ :8087    │
 └────┬────┘  └─────┬──────┘ └───┬────┘ └───┬────┘ └─────┬──────┘ └─────┬─────┘ └────┬─────┘
      │             │            │          │            │              │            │
      │        ┌────┴────────────┴──────────┴────────────┴──────────────┴────────────┴───┐
      │        │                          APACHE KAFKA                                    │
      │        │  calls.inbound · incidents.created · incidents.updated ·                 │
      │        │  dispatch.assignments · locations.updates · locations.viewport-req       │
      │        └────┬───────────────────────────────┬───────────────────────┬────────────┘
      │             │                                │                       │
      │             ▼                                ▼                       ▼
      │   ┌──────────────────┐            ┌────────────────────┐   ┌───────────────────┐
      │   │ call-simulator   │            │ location-ingest    │   │ location-simulator│
      │   │ crime-simulator  │            │ (consumer)         │   │ (OSRM routes)     │
      │   └──────────────────┘            └───────┬──────┬─────┘   └─────────┬─────────┘
      │                                           │      │                   │
      ▼                                           ▼      ▼                   │ routes
 ┌──────────────────────────────────────┐  ┌──────────┐ ┌──────────────┐    ▼
 │      PostgreSQL 16 + PostGIS          │  │ Redis 7  │ │ TimescaleDB  │  ┌────────┐
 │  users, roles, incidents, officers,   │  │ GEO:     │ │ location_    │  │ OSRM   │
 │  stations, vehicles, shifts, skills   │  │ live pos │ │ history      │  │ (London│
 │  (transactional, PostGIS spatial)     │  │ + pub/sub│ │ (hypertable) │  │  OSM)  │
 └──────────────────────────────────────┘  └──────────┘ └──────────────┘  └────────┘

 Cross-cutting: Dynatrace OneAgent auto-instruments every JVM + Postgres JDBC + Kafka clients.
```

## 2.2 Why each technology

### Backend — Java 21 + Spring Boot 3.3, Maven multi-module monorepo
Matches the workspace convention (`payments`), gives free **OneAgent** JVM instrumentation, and a
single `pom.xml` parent with `services/*` modules keeps the deploy pipeline identical to the
proven one. Spring Boot for REST + Spring Kafka + Spring Data JPA + Spring WebSocket.

### Messaging — Apache Kafka
Required, and the right tool. Two very different workloads share it cleanly:
- **Event stream** (calls, incidents, assignments) — low volume, durable, replayable audit log.
- **Telemetry firehose** (`locations.updates`, up to 3k/sec) — high volume, partitioned by
  officer-id for ordering, short retention.

Topics and partitioning are detailed in [doc 04](./04-microservices.md) and
[doc 05](./05-realtime-location-architecture.md).

### Transactional store — PostgreSQL 16 + PostGIS
One relational store for master + operational data. **PostGIS** is essential:
- "incidents within map bounds" → `ST_MakeEnvelope` + GiST index.
- "nearest station" and spatial joins → `ST_DWithin`, `<->` KNN operator.
Live *officer* positions do **not** live here (too hot) — Redis + TimescaleDB own those.

### Live location state — Redis 7 (GEO)
The single source of truth for **where every on-shift officer is right now**, shared across
containers. `GEOADD officers:live <lon> <lat> <officerId>` on every update;
`GEOSEARCH ... FROMLONLAT ... BYBOX` answers viewport & nearest-resource queries in sub-millisecond
time. Also carries a Redis **pub/sub** channel per geospatial "tile" so the WebSocket gateway can
fan out only relevant deltas. Chosen over Hazelcast/Memcached because GEO commands do exactly what
we need out of the box.

### Location history — TimescaleDB
Requirement: **append-only, very fast writes, queryable point-in-time and as a full journey, for
audit forever.** A Postgres 16 instance with the TimescaleDB extension gives:
- A **hypertable** `location_history` auto-partitioned by time → cheap high-rate inserts (batched
  `COPY`/multi-row inserts from the ingest consumer).
- Native **compression** on older chunks (10–20×) so months of trails stay affordable.
- **`time_bucket`** + `LATERAL` joins to answer "where was officer X at 14:32:05 last Tuesday?"
  and "give me officer X's full path between times A and B."
- It's still SQL/JDBC → trivial for Spring and for OneAgent to instrument.

**Alternative considered:** QuestDB / ClickHouse ingest faster still, but TimescaleDB keeps us in
one DB dialect, supports PostGIS geometry for path queries, and comfortably handles 3–20k rows/sec
on the target box. We use it and note QuestDB as the escape hatch if ingest ever dominates.

### Street routing & movement — OSRM (self-hosted)
The movement simulator must make officers **follow real London streets**, not teleport in straight
lines. OSRM, pre-processed with a **Greater London OSM extract**, returns route geometries for
`car`, `bike`, and `foot` profiles. The simulator advances each officer along its route at a
speed drawn from its mode (see [doc 05](./05-realtime-location-architecture.md)). Free, fast,
self-contained in a container. GraphHopper is the noted alternative.

### Map rendering — MapLibre GL JS + OpenFreeMap tiles
Leaflet struggles past a few thousand DOM markers. **MapLibre GL JS** renders on the GPU via
vector tiles, giving smooth zoom, rotation, and tens of thousands of symbol layers with
**zoom-dependent styling** — exactly the "different icons appear as you zoom/pan into focus"
requirement. Tiles from **OpenFreeMap** (free, no key) or self-hosted for offline demos. Marker
clustering via **Supercluster** when zoomed out.

### Frontend — React 18 + TypeScript + Vite + Tailwind
Slick, componentised, fast HMR. **Glassmorphism** design language (frosted panels, mesh gradients,
micro-animations) consistent with the workspace's `payments` app — see
[doc 07](./07-ui-ux-design.md). Real-time via **STOMP over WebSocket** with viewport subscriptions.

### AuthN/Z — Spring Security + JWT
Self-contained RBAC with roles + groups (RESPONDER, DISPATCHER, PLANNER, ADMIN). JWT minted by
`auth-service`, validated at the gateway. Keycloak is noted as an optional drop-in if we want SSO
later. Full model in [doc 08](./08-security-rbac.md).

## 2.3 Deployment shape

Everything runs under a **single `docker-compose.yml`** on the Hostinger box
(`srv970497.hstgr.cloud`), mirroring the `payments` project: parent `pom.xml`, `services/*`
modules each with a Dockerfile, `frontend/` React app, infra containers (Postgres, TimescaleDB,
Redis, Kafka, OSRM). GitHub Actions detects changed modules and does targeted `docker compose up
--build -d`. Full detail in [doc 09](./09-deployment-devops.md).

## 2.4 Observability

No manual OpenTelemetry — **Dynatrace OneAgent** auto-instruments every JVM, the Postgres/Timescale
JDBC calls, the Kafka producers/consumers, and the React app can carry RUM. The deploy workflow
posts a **`CUSTOM_DEPLOYMENT`** event per changed service (as in `payments`) for release
correlation. This is a primary reason the platform exists: it produces a rich, busy, distributed
trace surface.

## 2.5 Key non-functional targets

| NFR | Target |
|-----|--------|
| Location ingest | 3,000 msg/sec sustained, 20,000 burst |
| Redis GEO write | < 1 ms p99 |
| Viewport query (visible resources) | < 50 ms p95 end-to-end |
| Incident create → appears on dispatch queue | < 1 s |
| Map interaction (pan/zoom) | 60 fps, GPU-rendered |
| Point-in-time location history query | < 500 ms for a single officer/day |
| Nearest-trained-resource | < 100 ms p95 |
