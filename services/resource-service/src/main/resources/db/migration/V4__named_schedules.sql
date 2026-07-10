-- Named shift schedules — stores planner-configured weekly patterns
CREATE TABLE IF NOT EXISTS named_schedules (
    id          SERIAL PRIMARY KEY,
    name        TEXT    NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    data        JSONB   NOT NULL,          -- slider values + station overrides
    applied_to_weeks TEXT[] NOT NULL DEFAULT '{}'
);

-- Officer leave requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id          BIGSERIAL PRIMARY KEY,
    officer_id  BIGINT REFERENCES officers(id) ON DELETE CASCADE,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    days        INT  NOT NULL,
    reason      TEXT,
    status      TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | APPROVED | REJECTED
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at   TIMESTAMPTZ,
    decided_by   TEXT,
    CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_leave_officer ON leave_requests(officer_id);
CREATE INDEX IF NOT EXISTS idx_leave_status  ON leave_requests(status);
