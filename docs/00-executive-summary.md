# 00 — Executive Summary

## What we are building

A **simulated Metropolitan Police command-and-control (C2) platform** that models the full
life of a 999/111 emergency call — from the moment British Telecom hands over the call, through
assessment and incident creation, to dispatching officers and tracking every resource live on a
map of Greater London.

It exists to (a) be a slick, demonstrable C2 product and (b) generate rich, high-volume,
realistic telemetry for **Dynatrace observability** demonstrations (Kafka throughput, geospatial
query latency, WebSocket fan-out, JVM instrumentation across a microservice mesh).

## Three personas, one platform

| Persona | Role | Core screen |
|---------|------|-------------|
| **First Responder** | Answers the 999 call handed over by BT, captures caller/address, assesses the incident | Call console with live intake queue |
| **Dispatcher** | Sees prioritised live incidents, presses **READY** to take the next one, assigns nearest suitable resources on a map | Map-centric dispatch console |
| **Resource / Shift Planner** | Builds shift patterns for 40,000 officers, balances them across 110 stations, allocates vehicles & skills | Planning & rostering console |

Full flow: **BT hand-over → intake queue (Kafka) → responder captures details → simulators
enrich the incident → incident saved to Postgres with a `DDMMYY-NNNNNNN` reference →
appears on dispatcher's prioritised queue → dispatcher goes READY → incident becomes ACTIVE →
nearest trained resource assigned → resource goes `ON_ROUTE` → `ARRIVED` → resolved.**

## Headline technical decisions

| Concern | Decision | Why |
|---------|----------|-----|
| Language / framework | **Java 21 + Spring Boot 3.3**, Maven multi-module monorepo | Matches existing workspace (`payments`), OneAgent auto-instruments the JVM |
| Messaging backbone | **Apache Kafka** | Required; natural fit for call intake queue + 3k/sec location firehose |
| Transactional DB | **PostgreSQL 16 + PostGIS** | Incidents, officers, stations, shifts; PostGIS for "calls nearby" / "nearest resource" |
| Live location state | **Redis 7 (GEO commands)** | Cross-container in-memory cache; `GEOSEARCH` powers viewport & nearest-resource in <1ms |
| Location history | **TimescaleDB** (Postgres + hypertables) | Append-only, high-ingest, SQL-queryable point-in-time & full journey audit |
| Street routing / movement | **OSRM** (self-hosted, London OSM extract) | Free; snaps officer movement to real London streets for the simulator |
| Map rendering | **MapLibre GL JS** + **OpenFreeMap** vector tiles | Free/open; GPU-rendered, smooth zoom, thousands of markers, zoom-dependent icons |
| Frontend | **React 18 + TypeScript + Vite + Tailwind** | Slick UI, glassmorphism design language (matches workspace) |
| Browser real-time | **WebSocket (STOMP)** with **viewport subscriptions** | Only stream what's visible — the key scalability lever |
| AuthN/Z | **Spring Security + JWT**, role/group RBAC | Simple, self-contained; Keycloak noted as optional upgrade |
| Deploy | **Docker Compose on Hostinger** via **GitHub Actions** | Replicates the proven `payments` pipeline to `srv970497.hstgr.cloud` |

## Why the scale is tractable

Naively, 15,000 officers reporting position every 5 seconds = **3,000 writes/sec**, and a dozen
dispatchers each watching a map could imply pushing all of that to every browser. We avoid both
traps:

1. **Ingest fans into Kafka**, a single consumer group updates **Redis GEO** (current position)
   and appends to **TimescaleDB** (history). Postgres transactional tables are never hit by the
   firehose.
2. **Browsers subscribe to a viewport**, not to all officers. The backend answers with a
   `GEOSEARCH` bounded box and **clusters** results when zoomed out. A dispatcher watching one
   incident's neighbourhood receives maybe 50–300 markers, not 15,000.

See **[doc 05](./05-realtime-location-architecture.md)** for the full design.

## What's in scope for the prototype

- All three persona UIs, functional end-to-end.
- Call + crime simulators producing realistic synthetic incidents.
- Movement simulator walking/driving officers along real London streets.
- Shift-planning rules engine producing weekly rosters with demand weighting.
- Nearest-trained-resource selection with drag-and-drop assignment.
- RBAC with the three roles + admin.
- Full Docker Compose stack, auto-deployed to Hostinger.

## Explicitly out of scope (prototype)

- Real telephony / real BT integration (simulated hand-over only).
- Real PNC/CAD integration, real officer PII, real vehicle telematics.
- Statutory data-retention, GDPR, and security accreditation (this is synthetic data).
- Mobile officer app (we simulate the `ARRIVED` confirmation; a companion app is a future phase).

## Next step

Review the docs and mockups. On approval we execute **[the phased plan](./10-delivery-phases.md)**,
starting with Phase 0 (repo, skeleton, Compose, CI/CD) so the deploy pipeline is green before any
feature work.
