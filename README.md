# MPSCC — Metropolitan Police Service Command & Control

A simulated 999/111 emergency command-and-control platform for Greater London: call intake →
incident assessment → dispatch → live resource tracking across ~40,000 officers.

> **Prototype / simulation.** Synthetic data only. Not connected to any real emergency-service,
> telephony, or police system. Built to demonstrate a modern C2 experience and to generate rich
> Dynatrace observability telemetry.

📐 **Design package:** see [`docs/`](./docs/) (12 numbered docs) and the interactive design portal at
[`docs/mockups/index.html`](./docs/mockups/index.html).

## Stack

Java 21 · Spring Boot 3.3 · Spring Cloud Gateway · Apache Kafka · PostgreSQL 16 + PostGIS ·
Redis 7 (GEO) · TimescaleDB · OSRM · React 18 + TypeScript + Vite + Tailwind · MapLibre GL ·
Docker Compose · GitHub Actions → Hostinger.

## Run locally

```bash
cp .env.example .env      # fill secrets (JWT_SECRET etc.)
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API Gateway | http://localhost:8080 |
| Auth Service | http://localhost:8081 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| Kafka | localhost:9092 |

**Demo users** (all password `police123`): `responder`, `dispatcher`, `planner`, `admin`.

## Deploy

Push to `main` → GitHub Actions detects changed services and deploys to
`srv970497.hstgr.cloud:/opt/mpscc` via SSH (`docker compose up --build -d`). Change-detection does
a full restart on `docker-compose.yml` / `pom.xml` / `shared-lib` / `infrastructure` changes,
otherwise a targeted rebuild.

Required GitHub Actions secrets: `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`.

## Delivery phases

See [`docs/10-delivery-phases.md`](./docs/10-delivery-phases.md). Phase 0 (this commit): monorepo,
infra Compose, `api-gateway`, `auth-service`, React shell, CI/CD.

## Structure

```
pom.xml                      parent (Maven multi-module)
docker-compose.yml           full stack
services/
  shared-lib/                DTOs, JWT
  api-gateway/               Spring Cloud Gateway + JWT filter
  auth-service/              login, JWT, seeded users
frontend/                    React + Vite + Tailwind (nginx)
infrastructure/postgres/     PostGIS init
.github/workflows/           deploy pipeline
docs/                        design package + interactive mockups
```
