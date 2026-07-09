# MPSCC — Metropolitan Police Service Command & Control

> **MPSCC** = **M**etropolitan **P**olice **S**ervice **C**ommand & **C**ontrol
> A simulated 999 / 111 emergency command-and-control platform: call intake → incident
> assessment → dispatch → live resource tracking across Greater London (inside the M25).

This `docs/` folder is the **design and planning package for review**. No application code has
been written yet. Read the documents in order, then confirm whether we should build it.

---

## How to review

1. Start with **[00 — Executive Summary](./00-executive-summary.md)** for the one-page picture.
2. Skim the **HTML mockups** in [`mockups/`](./mockups/) to see the three persona screens.
   Open `mockups/index.html` in a browser.
3. Read the numbered docs in order for depth.
4. Jump to **[10 — Delivery Phases](./10-delivery-phases.md)** to see how the build is broken
   into token-safe, independently shippable phases.

## Document index

| # | Document | What it covers |
|---|----------|----------------|
| 00 | [Executive Summary](./00-executive-summary.md) | Vision, scope, headline decisions, the numbers |
| 01 | [Vision & Personas](./01-vision-and-personas.md) | The 3 personas, their jobs-to-be-done, the end-to-end flow |
| 02 | [System Architecture](./02-system-architecture.md) | Service topology, tech stack + rationale, C4-style diagrams |
| 03 | [Data Model](./03-data-model.md) | PostgreSQL/PostGIS schema, 40 crime types, incident numbering |
| 04 | [Microservices](./04-microservices.md) | Every service, its API, and Kafka topics |
| 05 | [Real-Time Location Architecture](./05-realtime-location-architecture.md) | Kafka + Redis GEO + TimescaleDB, viewport streaming, movement sim |
| 06 | [Resource & Shift Planning](./06-resource-and-shift-planning.md) | Rules engine, fleet, skills matrix, demand model |
| 07 | [UI / UX Design](./07-ui-ux-design.md) | Screen-by-screen design, map interactions, design system |
| 08 | [Security & RBAC](./08-security-rbac.md) | Roles, groups, JWT, authz model |
| 09 | [Deployment & DevOps](./09-deployment-devops.md) | Docker Compose, Hostinger, GitHub Actions CI/CD |
| 10 | [Delivery Phases](./10-delivery-phases.md) | Phased, token-safe build roadmap |
| 11 | [Data Sources & Seed Data](./11-data-sources-and-seed.md) | Postcodes, stations, crime data, scraping notes |

## Mockups

| File | Persona / screen |
|------|------------------|
| [`mockups/index.html`](./mockups/index.html) | Design-system landing + navigation to all mockups |
| [`mockups/responder.html`](./mockups/responder.html) | Persona 1 — 999 First Responder call console |
| [`mockups/dispatch.html`](./mockups/dispatch.html) | Persona 2 — Dispatcher map & incident queue |
| [`mockups/resource-planner.html`](./mockups/resource-planner.html) | Persona 3 — Resource & Shift Planner |

---

## The numbers this platform is designed for

| Dimension | Target |
|-----------|--------|
| 999 / 111 calls per day (peak) | 20,000 |
| Officers modelled | 40,000 |
| On-shift / on-call at peak | ~15,000 |
| Location updates | up to **~3,000/sec** (15k moving @ 5s cadence), 20k/sec headroom |
| Police stations & bases | 110 |
| Command centres | 3 — Bow, Lambeth, Hendon |
| Vehicles | 8,000 cars · 1,000 vans · 500 motorbikes · 600 pushbikes · dogs · horses |
| Firearms-trained officers | 6,000 |
| Crime types | 40 (petty → life-sentence) |
| Incident priorities | P1 (≤10 min response) → P5 (scheduled follow-up) |

## Guiding principle

> **The map only renders what you can see.** The platform never pushes 3,000 updates/sec to a
> browser. Clients subscribe to a *viewport* (map bounds + zoom); the backend streams only the
> resources inside that box, clustered when zoomed out. This single decision is what makes the
> scale tractable — see [doc 05](./05-realtime-location-architecture.md).

_This is a **simulation / prototype** for demonstration and Dynatrace observability purposes. It
uses synthetic data only and is not connected to any real emergency service system._
