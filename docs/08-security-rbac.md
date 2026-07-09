# 08 — Security & RBAC

> Prototype scope: authentication and authorisation are real and enforced, but this is a
> demonstration system on synthetic data — not accredited for real policing use.

## 8.1 Model

**Roles** (coarse capability) and **Groups** (organisational scoping, e.g. by command centre or
borough). A user has one or more roles and belongs to zero or more groups.

| Role | Can |
|------|-----|
| `RESPONDER` | Answer intake calls, create incidents, view own created incidents |
| `DISPATCHER` | View incident queue, go READY, take/assign/track incidents, query resources & map |
| `PLANNER` | Generate/edit rosters, view resources, fleet, stations; no incident dispatch |
| `ADMIN` | Manage users/roles/groups, seed & simulator controls, everything |

**Groups** (examples): `MetCC-Bow`, `MetCC-Lambeth`, `MetCC-Hendon`, `Borough-Westminster`. Groups
scope *what data* a user sees (e.g. a Bow dispatcher's default map region), while roles scope *what
actions*.

## 8.2 AuthN

- `auth-service` issues a **JWT** on username/password login (BCrypt hashes; seeded demo users per
  role). Token carries `sub`, `roles[]`, `groups[]`, `station_id`, exp (~8 h shift-length).
- **API Gateway** validates the JWT on every request (signature + expiry) via a global filter —
  same pattern as the `payments` gateway — and forwards identity headers to services.
- WebSocket handshake authenticates with the same JWT (query param/`Authorization` on CONNECT).

## 8.3 AuthZ

- **Gateway route guards:** each route requires a role (e.g. `/api/dispatch/**` → `DISPATCHER`).
- **Method security** in services: `@PreAuthorize("hasRole('DISPATCHER')")` etc. on controllers.
- **Data scoping:** group claims filter queries (a Bow user's viewport/queue defaults to Bow's
  region; ADMIN sees all). Enforced in `geo-query` and `incident` services.
- **Simulator/seed controls** (`/api/admin/**`, `/api/sim/**`) → `ADMIN` only.

## 8.4 Secrets & config
- No secrets in code or git. `.env` (git-ignored) + `.env.example` committed, mirroring
  `payments`. JWT signing secret, DB passwords, Redis/Kafka creds injected via env.
- Deploy credentials (`DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`, `DT_*`) live only in GitHub
  Actions secrets.
- **Note for the new repo:** use an **SSH deploy key**, not a PAT-in-URL remote, to avoid the
  credential-in-URL issue present in the `payments` remote.

## 8.5 Optional upgrade
Drop in **Keycloak** as the IdP (OIDC) if SSO/enterprise auth is wanted later — the gateway
already validates JWTs, so the change is mostly issuer config. Out of scope for the prototype.
