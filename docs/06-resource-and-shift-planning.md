# 06 — Resource & Shift Planning

The planner persona's engine. Goal: get **40,000 officers** onto **10-hour shifts** across the
week, balanced across **110 stations**, matched to **demand**, with the right **skills** and
**vehicles** on at the right times — including **6,000 firearms** officers with continuous cover.

## 6.1 Shift model

Four rotating **10-hour** patterns with 2-hour overlaps for handover:

| Pattern | Start | End | Notes |
|---------|-------|-----|-------|
| EARLY | 06:00 | 16:00 | day build-up |
| DAY | 10:00 | 20:00 | daytime peak |
| LATE | 16:00 | 02:00 | evening/night peak (Fri/Sat heavy) |
| NIGHT | 22:00 | 08:00 | trough cover 23:00–06:00 |

Officers rotate across patterns week to week (fairness) with statutory-style rest gaps between
shifts (≥11 h) enforced by the engine.

## 6.2 Demand model

The rules engine staffs to a **demand curve**, not flat headcount. Demand `D(day, hour)` is a
product of factors, normalised to a target on-shift count:

```
D(day,hour) = base
            × dayFactor[day]         // Mon 0.85 … Fri 1.25, Sat 1.30, Sun 1.05
            × hourFactor[hour]       // low 03:00 (0.4) … peak 18:00–23:00 (1.4)
            × boroughFactor[borough] // busier boroughs (Westminster, Camden) weighted up
```

- `hourFactor` dips to ~0.4 between **23:00–06:00** (less reported crime) and peaks evenings.
- `dayFactor` makes **Fri/Sat** busiest, **Mon/Tue** lightest.
- Target on-shift ranges from ~**6,000 (deep night)** to ~**15,000 (Fri/Sat evening)**.

## 6.3 Rules engine

A pragmatic **constraint-weighted allocator** (not a full ILP solver for the prototype — keep it
fast and explainable). Options exposed to the planner:

**Hard constraints (must hold):**
- Each officer ≤ 1 shift/day; ≥ 11 h rest between shifts; ≤ 48 h/week average.
- Firearms coverage: ≥ configured minimum armed officers on-shift **every hour** (e.g. ≥ 1,500 of
  6,000 at all times, more at peak).
- Every station staffed above its **minimum viable** count at all hours.

**Soft constraints (optimise / weighted):**
- Match on-shift count to `D(day,hour)` as closely as possible.
- Balance officers across stations proportional to `station.capacity` / `size_band`.
- Spread skills (detectives, dog handlers, public order, traffic) across shifts & boroughs.
- Fair rotation of unpopular NIGHT shifts.

**Algorithm (per week):**
1. Compute hourly demand targets per borough.
2. Convert to per-pattern per-station headcount targets (waterfall fill by demand).
3. Greedy assignment of officers to (station, pattern, day) respecting hard constraints, ordered
   to satisfy scarce skills first (firearms, then specialists, then general).
4. Local-search rebalance pass: swap assignments that reduce total soft-constraint penalty.
5. Emit `officer_shifts` rows + a **coverage report** (heatmap data: demand vs staffed per
   hour/station).

Exposed as `POST /api/planning/generate?weekStart=YYYY-MM-DD` with a rules payload the planner can
tune from the UI; returns the roster + coverage metrics.

## 6.4 Fleet & vehicle allocation

Fleet totals (seed):

| Type | Count | Seats |
|------|------:|:-----:|
| CAR | 8,000 | 2 |
| VAN | 1,000 | up to 10 |
| MOTORBIKE | 500 | 1 |
| SCOOTER | ~200 | 1 |
| PUSHBIKE | 600 | 1 |
| DOG_CAR | ~60 | 1 (+ dog) |
| HORSE | ~30 | 1 |
| **Total** | **~10,390** | |

At **book-on**, on-shift officers are allocated vehicles by rule:
- Firearms & response officers → CAR/VAN (advanced-driver skill required for fast cars).
- Traffic officers → MOTORBIKE/CAR.
- Neighbourhood officers → FOOT / PUSHBIKE.
- Dog handlers → DOG_CAR; mounted → HORSE.
- Vans crew up to 10 (public-order deployments) — modelled as one moving unit with N officers.
- Vehicles not enough for all → remainder deploy on FOOT. Allocation writes
  `vehicle_assignments` and sets each officer's live `mode`.

## 6.5 Skills matrix

`skills` seed (~15): FIREARMS, ADVANCED_DRIVER, DETECTIVE, SENIOR_DETECTIVE,
MURDER_INVESTIGATION, DOG_HANDLER, MOUNTED, PUBLIC_ORDER, TRAFFIC, NEGOTIATOR, MEDICAL_FIRST_AID,
CBRN, SURVEILLANCE, CYBER, CHILD_PROTECTION.

Distribution across 40,000 (seeded, roughly realistic proportions):
- FIREARMS: 6,000 · ADVANCED_DRIVER: ~9,000 · DETECTIVE: ~5,000 · SENIOR_DETECTIVE: ~800 ·
  DOG_HANDLER: ~250 · MOUNTED: ~120 · PUBLIC_ORDER: ~4,000 · TRAFFIC: ~1,500 ·
  NEGOTIATOR: ~200 · others spread.

The dispatcher's **"nearest trained resource"** filters live officers by required skill (e.g.
`FIREARMS_INCIDENT` → officers with `FIREARMS` currently on-shift and armed) before ranking by
ETA (see [doc 04](./04-microservices.md) `geo-query`).

## 6.6 Planner UI outputs
- **Roster grid:** officers × days, colour-coded by pattern; drag to reassign.
- **Coverage heatmap:** hour × station, green (met) → red (under), with the demand curve overlaid.
- **Station balance:** bar/scatter of staffed vs capacity per station; flags over/under.
- **Skills & firearms cover:** live count of each skill on-shift per hour; firearms minimum line.
- **Fleet utilisation:** vehicles in use vs available by type.

Details and mockup in [doc 07](./07-ui-ux-design.md) and `mockups/resource-planner.html`.
