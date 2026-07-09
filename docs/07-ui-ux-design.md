# 07 — UI / UX Design

## 7.1 Design language

A **control-room aesthetic**: dark, calm, information-dense but not cluttered, with the
glassmorphism + micro-animation polish used across the workspace. High legibility under pressure.

**Design tokens**

| Token | Value |
|-------|-------|
| Base background | near-black navy mesh gradient `#0a0e1a → #111827` with subtle radial glows |
| Panels | frosted glass — `rgba(255,255,255,0.06)` + `backdrop-blur(18px)` + `1px` hairline border `rgba(255,255,255,0.12)` |
| Accent (brand) | electric blue `#2f6bff` → cyan `#22d3ee` gradient |
| Font | Inter / system UI; tabular numerals for queues, timers, coordinates |
| Radius | 16px panels, 10px controls |
| Motion | 150–250ms ease-out; hover lift `-2px`; active `scale(0.97)`; queue rows pulse on arrival |

**Priority colour system** (used for banners, pins, queue rows — consistent everywhere):

| Priority | Colour | Hex | Use |
|:--:|--------|-----|-----|
| P1 | Red | `#ef4444` | RED banner, pulsing pin |
| P2 | Amber | `#f59e0b` | |
| P3 | Yellow | `#eab308` | |
| P4 | Blue | `#3b82f6` | |
| P5 | Grey | `#6b7280` | |

**Resource status colours:** AVAILABLE green `#22c55e` · ON_ROUTE cyan `#22d3ee` ·
ON_SCENE violet `#a855f7` · BUSY amber · STALE grey.

**Resource icons** (by mode, appear at zoom): 🚶 foot · 🚗 car · 🚐 van · 🏍 motorbike · 🛵 scooter ·
🚲 pushbike · 🐕 dog car · 🐎 horse · 🏢 station · 🏛 command centre. Real build uses custom SVG
symbol sprites in the MapLibre style, rotated by heading.

## 7.2 Global shell

- **Left rail:** persona switcher (only shows personas the user's roles allow), MPSCC logo,
  status dot, user menu.
- **Top bar:** environment tag, live clock (Europe/London), global search (incident ref /
  collar number / postcode), sim-intensity indicator, notifications.
- **Content:** persona workspace.
- Everything real-time via a single WebSocket connection multiplexed by topic.

## 7.3 Persona 1 — First Responder console

```
┌───────────────────────────────────────────────────────────────────────┐
│ MPSCC · 999 RESPONDER          London 14:32:07   Queue: ▓▓▓▓▓░░ 23      │
├───────────────┬───────────────────────────────┬────────────────────────┤
│ INTAKE QUEUE  │  ACTIVE CALL                   │  LIVE ASSESSMENT       │
│               │  ┌─────────────────────────┐   │  (streams as caller    │
│ ▓ 23 waiting  │  │ ☎ +44 7700 900123       │   │   talks)               │
│ gauge (ebbs)  │  │ Location fix: MOBILE     │   │  Crime: BURGLARY ▼     │
│               │  │  51.512, -0.121 ±180m    │   │  Injuries?   ○ yes ● no│
│ [ ANSWER NEXT]│  │  [map pin + radius]      │   │  Weapons?    ○ yes ● no│
│               │  └─────────────────────────┘   │  Suspects on scene? ●  │
│ recent calls  │  Caller name: [__________]     │  People at risk: [ 0 ] │
│ · 0010041 P2  │  Address:     [__________]     │  ──────────────────    │
│ · 0010039 P4  │  Postcode:    [SW1A ___]       │  Suggested priority: 2 │
│               │                                │  [ 1 ][2][3][4][5]     │
│               │                                │  [ CREATE INCIDENT ]   │
└───────────────┴───────────────────────────────┴────────────────────────┘
```

- **Intake queue gauge** ebbs/flows live (from `calls.inbound` rate).
- **ANSWER NEXT** pulls a call: number + BT location fix pre-filled; if MOBILE, a mini-map shows
  the pin and accuracy radius, editable to a confirmed address.
- **Live assessment** panel fills from the crime stream; responder confirms/overrides fields and
  priority, then **CREATE INCIDENT** → toast with the `DDMMYY-NNNNNNN` reference.
- Keyboard-first: `Enter`=answer, `Ctrl+Enter`=create, number keys set priority.

## 7.4 Persona 2 — Dispatcher console (map-centric)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ MPSCC · DISPATCH        [ READY ▶ take next ]      Active: 040726-0010042   │
├──────────────┬──────────────────────────────────────────────┬─────────────┤
│ INCIDENT     │  🔴 P1  BURGLARY (AGG)  040726-0010042  02:14 │ RESOURCES   │
│ QUEUE        │ ┌──────────────────────────────────────────┐ │ nearest:    │
│ (prio+age)   │ │                                          │ │ ● PC2456 🚗 │
│ 🔴 P1 0010042│ │            M A P                          │ │  4 min ETA  │
│    02:14 ⏱   │ │  (MapLibre GL, centred on incident)      │ │ ● PS0912 🏍 │
│ 🟠 P2 0010040│ │  incident pin (pulsing red)              │ │  6 min ETA  │
│    11:32 ⏱   │ │  resource icons by mode/status           │ │ ● DOG 07 🐕 │
│ 🟡 P3 0010037│ │  station 🏢 / command 🏛 at zoom          │ │             │
│ 🔵 P4 ...    │ │  clusters when zoomed out                │ │ [nearest    │
│ ⚪ P5 ...     │ │                          [⌖ recentre]     │ │  trained ▼] │
│              │ └──────────────────────────────────────────┘ │ FIREARMS ✓  │
│              │  Incident detail · caller · assessment · map  │ drag to     │
│              │  scale · assigned units · ETA · timeline      │ assign →    │
└──────────────┴──────────────────────────────────────────────┴─────────────┘
```

- **READY** button → **take next** highest-priority/oldest incident; it becomes ACTIVE and its
  **coloured banner** (RED for P1) heads the workspace.
- **Incident queue** (left) sorted by priority then age; each row shows a **live ticking age**
  (`⏱`) and its priority colour; new arrivals slide in with a pulse.
- **Central map** (MapLibre GL):
  - Centred on the active incident; **scroll/zoom** brings **nearby incidents & resources** into
    focus; **⌖ recentre** button top-right snaps back to the incident.
  - **Zoom-dependent rendering:** clusters far out → typed, heading-rotated icons close in;
    stations/command centres appear at their threshold.
  - **Route overlay** to a candidate/assigned unit with OSRM ETA.
- **Resources panel** (right): **"select nearest trained resource"** with a skills filter (e.g.
  FIREARMS). Ranked by ETA. **Drag a resource onto the incident** (or the map pin) to assign →
  unit flips to ON_ROUTE, route draws, ETA counts down; officer later confirms **ARRIVED**.
- **Timeline** strip logs every state change (created → active → assigned → on route → arrived →
  resolved) for the audit story.

## 7.5 Persona 3 — Resource & Shift Planner

```
┌───────────────────────────────────────────────────────────────────────────┐
│ MPSCC · PLANNER    Week of 06 Jul 2026    [ Generate roster ] [ rules ⚙ ]  │
├───────────────────────────────────────────────────────────────────────────┤
│ DEMAND vs STAFFED (hour × day heatmap)          FIREARMS COVER (line)       │
│ ▓▓▓░░ green=met  ▓▓▓ red=under                   ─────╭──╮──── min ───────   │
├──────────────────────────────┬────────────────────────────────────────────┤
│ STATION BALANCE               │ ROSTER GRID (officers × days)               │
│ bars: staffed vs capacity     │ EARLY/DAY/LATE/NIGHT colour blocks          │
│ flags over/under              │ drag to reassign · scarce-skill filter      │
├──────────────────────────────┴────────────────────────────────────────────┤
│ FLEET UTILISATION  CAR 82% · VAN 61% · BIKE 40% · DOG 55% · HORSE 30%       │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Generate roster** runs the rules engine (doc 06); tune **rules** (demand weights, firearms
  minimum, rest gaps) in a side panel and re-run.
- **Heatmaps & charts** show coverage quality; **station balance** flags over/under-staffing;
  **fleet utilisation** shows vehicle allocation.
- Drag-to-reassign on the roster grid with live constraint validation.

## 7.6 Interaction & accessibility principles
- **Keyboard-first** for responder/dispatch (speed under load).
- **Colour + shape** always paired (never colour alone) for priority/status — accessible.
- **No destructive action without an obvious undo** (except confirmed resolve).
- **Live everything:** queues, ages, positions, gauges update over WebSocket; no manual refresh.
- **Latency masking:** optimistic UI on assign/READY with server reconciliation.

## 7.7 Frontend tech
React 18 + TS + Vite + Tailwind; MapLibre GL JS + Supercluster; STOMP.js over WebSocket;
TanStack Query for REST; Zustand for view state; Recharts for planner charts. Design tokens as CSS
variables so the glass theme is centrally controlled.
