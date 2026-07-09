# 01 — Vision & Personas

## Vision

Model, end-to-end, how a modern police force turns a **999 call into an officer arriving at a
scene** — and make the whole thing observable, fast, and beautiful. The platform is a living
simulation: calls arrive on their own, crimes are invented plausibly, and thousands of officers
move around London in real time whether or not anyone is watching.

## The end-to-end journey

```
        ┌─────────────┐   BT answers 999, geolocates caller
        │  Caller     │   (landline address / mobile triangulation / GPS)
        └──────┬──────┘
               │  hand-over (simulated)
               ▼
   ┌───────────────────────┐     Kafka: calls.inbound
   │  INTAKE QUEUE          │◀────────────── call-simulator-service
   │  (ebbs & flows)        │                (reads M25 postcodes → addresses)
   └───────────┬───────────┘
               │  responder pulls next call
               ▼
   ┌───────────────────────┐     crime-simulator streams incident detail
   │  PERSONA 1: RESPONDER  │◀────────────── crime-simulator-service
   │  captures name/addr,   │                (40 crime types, narrative, priority 1–5)
   │  assesses, confirms    │
   └───────────┬───────────┘
               │  incident saved → Postgres, ref DDMMYY-NNNNNNN
               ▼
   ┌───────────────────────┐     Kafka: incidents.created
   │  DISPATCH QUEUE        │     ordered by priority + age
   │  WAITING → ACTIVE      │
   └───────────┬───────────┘
               │  dispatcher presses READY → takes next
               ▼
   ┌───────────────────────┐     map + panels; nearest trained resource
   │  PERSONA 2: DISPATCHER │────▶ assign → ON_ROUTE → ARRIVED → RESOLVED
   └───────────────────────┘
               ▲
               │ resource positions (Redis GEO, live)
   ┌───────────────────────┐     Kafka: locations.updates (~3k/sec)
   │  MOVEMENT SIMULATOR    │────▶ officers walk/drive real London streets (OSRM)
   └───────────────────────┘
               ▲
               │ who is on shift, where, with what vehicle & skills
   ┌───────────────────────┐
   │  PERSONA 3: PLANNER    │     rosters 40k officers, balances 110 stations
   └───────────────────────┘
```

---

## Persona 1 — First Responder (999 call handler)

**Who:** The MetCC operator who first speaks to a caller after BT triage.
**Goal:** Get accurate details into the system fast and assign an initial priority.

**Context that matters:**
- Up to **20,000 calls/day** at peak; the 999 line is busy. The UI must be keyboard-first and
  fast — no hunting for buttons.
- BT provides the **phone number** and a **location fix** already:
  - Landline → registered address.
  - Mobile → triangulated location (cell towers), Wi-Fi geo, or handset GPS. May be an
    approximate lat/long with an accuracy radius rather than a clean address.

**Their screen shows:**
- **Inbound queue level** (a live gauge that ebbs and flows) and the next call to answer.
- On answer: caller number pre-filled, location fix pre-filled (address *or* a map pin + accuracy
  radius). Operator captures/corrects **name** and **address**.
- A **live incident-detail stream** (from the crime simulator) so the assessment panel fills in
  as the "caller talks": crime type, description, injuries, weapons, suspects on scene.
- A **priority selector (1–5)** with guidance, defaulting to the simulator's assessed priority.
- A **confirm & create** action → generates the incident reference and hands to dispatch.

**Jobs-to-be-done:** answer fast · verify location · classify crime · set priority · create
incident.

---

## Persona 2 — Dispatcher

**Who:** The operator who commands resources to incidents.
**Goal:** Get the right officers to the right incident in priority order, and track them until
they arrive and resolve it.

**Their screen shows:**
- A **prioritised, aging incident queue** — each incident shows its **priority (1–5)** and its
  **age** (seconds → minutes → days). More P2–P5 than P1, but a meaningful P1 volume.
- A big **READY** button. Pressing it takes the next appropriate incident, moving it from
  **WAITING** to **ACTIVE** and loading its full detail.
- **Coloured priority banners:** P1 = **RED**, P2 = **amber/orange**, P3 = **yellow**,
  P4 = **blue**, P5 = **grey/green** (final palette in [doc 07](./07-ui-ux-design.md)).
- A **central map** centred on the active incident's address. Zooming out brings **nearby
  incidents** and **resources** into focus. Icons differ by resource type (officer on foot,
  bike, car, van, motorbike, scooter, horse, dog unit) and appear only at appropriate zoom.
- **"Recentre on incident"** button top-right.
- **Police-station / command-centre icons** appear as you zoom/pan into them.
- **Drag-and-drop assignment** + a **"select nearest trained resource"** action (e.g. a firearms
  incident filters to armed officers within range). Assignments move a resource to `ON_ROUTE`;
  the officer later confirms `ARRIVED`.

**Jobs-to-be-done:** triage queue · take next · find suitable nearby resource · dispatch · track
to arrival · resolve.

---

## Persona 3 — Resource & Shift Planner

**Who:** The workforce/duty planner.
**Goal:** Ensure the right number of appropriately skilled officers are on shift, in the right
places, at the right times.

**Context that matters:**
- **40,000 officers**, **10-hour shifts** rotated across the week.
- **Demand is uneven:** Fri/Sat busier than Mon/Tue; **less crime 23:00–06:00**. The rules engine
  must staff to demand, not flat.
- Officers are **assigned to one of 110 stations/bases**, balanced by station size.
- Officers carry **skills/certifications** (firearms, detective, senior detective, dog handler,
  public order, traffic, etc.) and are allocated **vehicles** (car reg / asset number).
- **6,000 firearms-trained** officers on rotating shift patterns.

**Their screen shows:**
- A **rota builder** driven by the rules engine, with demand curves overlaid.
- **Station balancing** view (heat of over/under-staffing per station).
- **Skills matrix** and fleet allocation (which officer has which vehicle).
- Simulation controls: generate a week's roster, tweak rules, re-balance.

**Jobs-to-be-done:** forecast demand · generate rosters · balance stations · allocate skills &
vehicles · maintain firearms coverage.

---

## Cross-cutting: the always-on simulation

Even with nobody logged in, the platform is alive:
- **call-simulator** keeps the intake queue ebbing and flowing.
- **crime-simulator** keeps inventing plausible incidents.
- **movement-simulator** keeps every on-shift officer moving along real streets.
- **shift-planning** rolls the roster forward day by day.

This is what produces the continuous, high-volume telemetry the platform is designed to show off.
