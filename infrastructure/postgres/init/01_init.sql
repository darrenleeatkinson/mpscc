-- MPSCC transactional database bootstrap.
-- Runs once on first container start (postgis/postgis image).
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schema objects are created by each service via Flyway / JPA on startup.
-- This file only guarantees the spatial extension is present.
