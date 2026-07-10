package com.mpscc.resource.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/schedules")
public class ShiftScheduleController {

    private final JdbcTemplate jdbc;

    public ShiftScheduleController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public List<Map<String, Object>> list() {
        return jdbc.queryForList("""
                SELECT id, name, created_at, updated_at,
                       data::text AS data, applied_to_weeks
                FROM named_schedules
                ORDER BY updated_at DESC
                """);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> save(@RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        String data = body.get("data") instanceof String s ? s
                : com.fasterxml.jackson.databind.json.JsonMapper.builder().build()
                    .valueToTree(body.get("data")).toString();

        jdbc.update("""
                INSERT INTO named_schedules (name, data, updated_at)
                VALUES (?, ?::jsonb, now())
                ON CONFLICT (name) DO UPDATE
                  SET data = EXCLUDED.data, updated_at = now()
                """, name, data);

        Map<String, Object> saved = jdbc.queryForMap(
                "SELECT id, name, created_at, updated_at FROM named_schedules WHERE name = ?", name);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable int id) {
        jdbc.update("DELETE FROM named_schedules WHERE id = ?", id);
        return ResponseEntity.noContent().build();
    }

    // ── Leave requests ─────────────────────────────────────────────────────

    @GetMapping("/leave")
    public List<Map<String, Object>> listLeave(
            @RequestParam(required = false) String status) {
        if (status != null) {
            return jdbc.queryForList("""
                    SELECT lr.id, lr.officer_id,
                           o.collar_number, o.forename, o.surname, o.rank,
                           s.name AS station_name,
                           lr.start_date, lr.end_date, lr.days,
                           lr.reason, lr.status, lr.requested_at, lr.decided_at
                    FROM leave_requests lr
                    JOIN officers o ON o.id = lr.officer_id
                    LEFT JOIN stations s ON s.id = o.home_station
                    WHERE lr.status = ?
                    ORDER BY lr.requested_at DESC
                    """, status);
        }
        return jdbc.queryForList("""
                SELECT lr.id, lr.officer_id,
                       o.collar_number, o.forename, o.surname, o.rank,
                       s.name AS station_name,
                       lr.start_date, lr.end_date, lr.days,
                       lr.reason, lr.status, lr.requested_at, lr.decided_at
                FROM leave_requests lr
                JOIN officers o ON o.id = lr.officer_id
                LEFT JOIN stations s ON s.id = o.home_station
                ORDER BY lr.requested_at DESC
                LIMIT 200
                """);
    }

    @PostMapping("/leave/{id}/decide")
    public ResponseEntity<Void> decide(
            @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        String decision = (String) body.get("status"); // APPROVED or REJECTED
        jdbc.update("""
                UPDATE leave_requests
                SET status = ?, decided_at = now(), decided_by = ?
                WHERE id = ?
                """, decision, body.getOrDefault("decidedBy", "PLANNER"), id);
        return ResponseEntity.ok().build();
    }

    // ── Station officer summary ─────────────────────────────────────────────

    @GetMapping("/station-summary")
    public List<Map<String, Object>> stationSummary() {
        return jdbc.queryForList("""
                SELECT s.id, s.name, s.borough, s.capacity, s.size_band,
                       ST_Y(s.location::geometry) AS latitude,
                       ST_X(s.location::geometry) AS longitude,
                       COUNT(o.id)                AS officer_count
                FROM stations s
                LEFT JOIN officers o ON o.home_station = s.id
                GROUP BY s.id, s.name, s.borough, s.capacity, s.size_band, s.location
                ORDER BY s.name
                """);
    }
}
