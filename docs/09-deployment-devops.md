# 09 — Deployment & DevOps

Replicates the proven `payments` pipeline: monorepo → GitHub → GitHub Actions → SSH deploy to
Hostinger → `docker compose up --build -d`.

## 9.1 Target

- **Host:** `srv970497.hstgr.cloud` (Hostinger VPS, already used for `payments`).
- **Deploy dir:** `/opt/mpscc` (clone of the new repo).
- **New GitHub repo:** `darrenleeatkinson/mpscc` (create fresh; **use SSH deploy key**, not a
  token-in-URL remote).

## 9.2 Repo layout (monorepo)

```
mpscc/
├── pom.xml                         # parent, <modules> for each service
├── docker-compose.yml              # full stack
├── .env.example                    # documented env (real .env git-ignored)
├── .github/workflows/
│   ├── deploy.yml                  # change-detection targeted deploy (from payments)
│   └── rollback.yml
├── services/
│   ├── shared-lib/
│   ├── api-gateway/                # each has Dockerfile
│   ├── auth-service/
│   ├── call-intake-service/
│   ├── incident-service/
│   ├── dispatch-service/
│   ├── resource-service/
│   ├── geo-query-service/
│   ├── shift-planning-service/
│   ├── location-ingest-service/
│   ├── location-simulator-service/
│   ├── call-simulator-service/
│   ├── crime-simulator-service/
│   └── routing-service/
├── frontend/                       # React app + Dockerfile (nginx serve)
├── infrastructure/
│   ├── postgres/ (init SQL, PostGIS)
│   ├── timescale/ (init SQL)
│   ├── redis/
│   ├── kafka/
│   └── osrm/ (London extract + pre-process script)
├── docs/                           # this folder
└── dynatrace/                      # OneAgent notes
```

## 9.3 Docker Compose stack

Containers: `postgres` (PostGIS), `timescaledb`, `redis`, `kafka` (+`zookeeper` or KRaft),
`osrm`, the 13 Spring services, `frontend` (nginx). Healthchecks + `depends_on` ordering so
services wait for infra. Named volumes for Postgres/Timescale/Kafka. Single Compose file, same as
`payments`.

Resource reality on one VPS: the JVM services are many. Mitigations — small heaps
(`-Xmx256m`), lazy Spring init, and optionally **fold** the two simulators and
`call-intake`/`incident` into fewer containers (see [doc 10](./10-delivery-phases.md)). OSRM +
Kafka are the heaviest; size the VPS accordingly.

## 9.4 CI/CD (GitHub Actions)

Reuse `payments/.github/workflows/deploy.yml` almost verbatim:

1. **detect-changes** job maps changed `services/<name>/*` paths to service names; changes to
   `docker-compose.yml` / `pom.xml` / `services/shared-lib/*` / `infrastructure/*` trigger a
   **full restart**; docs-only changes **skip**.
2. **deploy** job: `webfactory/ssh-agent` with `secrets.DEPLOY_SSH_KEY`, SSH to
   `${DEPLOY_USER}@${DEPLOY_HOST}`, `cd /opt/mpscc`, `git fetch && git reset --hard origin/main`,
   then `docker compose up --build -d <targeted services>` (or full). 3× retry.
3. **Dynatrace event** job posts a `CUSTOM_DEPLOYMENT` event per changed service for release
   correlation (identical script to `payments`, product renamed `mpscc`).

**GitHub Actions secrets to set:** `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`, `DT_ENV_URL`,
`DT_API_TOKEN`.

## 9.5 Bootstrap on the VPS (one-time)
```bash
# on srv970497.hstgr.cloud
sudo git clone git@github.com:darrenleeatkinson/mpscc.git /opt/mpscc
cd /opt/mpscc && cp .env.example .env   # fill secrets
docker compose up --build -d
```
Thereafter GitHub Actions handles updates on push to `main`. Per the workspace rule: **never scp**
— always commit/push and let the VPS pull.

## 9.6 Observability
Dynatrace **OneAgent** on the host auto-instruments all JVMs, Postgres/Timescale JDBC, Kafka
clients, and nginx. Optional RUM on the React app. Deploy events pin releases to the problem
timeline. This platform is, deliberately, a dense trace generator.

## 9.7 Environments
Single **production-like** environment on Hostinger for the prototype (plus local
`docker compose up` for dev). No staging in phase 1; can add later.
