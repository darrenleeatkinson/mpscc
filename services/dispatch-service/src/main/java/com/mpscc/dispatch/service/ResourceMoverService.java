package com.mpscc.dispatch.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ResourceMoverService {

    private static final Map<String, Double> SPEED_MS = Map.of(
            "CAR",       8.3,
            "VAN",       8.3,
            "DOG_CAR",   8.3,
            "MOTORBIKE", 11.1,
            "SCOOTER",   8.3,
            "PUSHBIKE",  5.6,
            "FOOT",      1.4
    );
    private static final double TICK_SEC   = 5.0;
    private static final double ON_SCENE_M = 100.0;

    private final JdbcTemplate jdbc;

    public ResourceMoverService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Scheduled(fixedRate = 5000)
    @Transactional
    public void tick() {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT dr.id, dr.mode, dr.current_lat, dr.current_lon,
                       dr.target_lat, dr.target_lon, dr.dispatch_id
                FROM dispatch_resources dr
                JOIN dispatches d ON d.id = dr.dispatch_id
                WHERE d.status = 'ACTIVE'
                  AND dr.current_lat IS NOT NULL
                  AND dr.target_lat  IS NOT NULL
                """);

        if (rows.isEmpty()) return;

        // tracks [total, arrived] per dispatch
        Map<Long, int[]> counts = new HashMap<>();

        for (Map<String, Object> row : rows) {
            long   id         = toLong(row,   "id");
            long   dispatchId = toLong(row,   "dispatch_id");
            double curLat     = toDouble(row, "current_lat");
            double curLon     = toDouble(row, "current_lon");
            double tgtLat     = toDouble(row, "target_lat");
            double tgtLon     = toDouble(row, "target_lon");
            String mode       = row.get("mode") instanceof String s ? s : "FOOT";

            int[] c = counts.computeIfAbsent(dispatchId, k -> new int[2]);
            c[0]++;

            double dist = haversineM(curLat, curLon, tgtLat, tgtLon);
            if (dist <= ON_SCENE_M) {
                c[1]++;
                continue;
            }

            double speed   = SPEED_MS.getOrDefault(mode, 1.4);
            double step    = Math.min(speed * TICK_SEC, dist);
            double frac    = step / dist;
            double newLat  = curLat + (tgtLat - curLat) * frac;
            double newLon  = curLon + (tgtLon - curLon) * frac;

            jdbc.update(
                    "UPDATE dispatch_resources SET current_lat=?, current_lon=? WHERE id=?",
                    newLat, newLon, id);

            if (haversineM(newLat, newLon, tgtLat, tgtLon) <= ON_SCENE_M) {
                c[1]++;
            }
        }

        // Auto-advance dispatch to ON_SCENE when all resources arrive
        counts.forEach((dispatchId, c) -> {
            if (c[1] >= c[0]) {
                int updated = jdbc.update(
                        "UPDATE dispatches SET status='ON_SCENE', on_scene_at=now() WHERE id=? AND status='ACTIVE'",
                        dispatchId);
                if (updated > 0) {
                    jdbc.update("UPDATE incidents SET status='ON_SCENE' WHERE id=(SELECT incident_id FROM dispatches WHERE id=?)", dispatchId);
                    jdbc.update("UPDATE officers SET status='ON_SCENE' WHERE id IN (SELECT resource_id FROM dispatch_resources WHERE dispatch_id=? AND resource_type='OFFICER')", dispatchId);
                    jdbc.update("UPDATE vehicles  SET status='ON_SCENE' WHERE id IN (SELECT resource_id FROM dispatch_resources WHERE dispatch_id=? AND resource_type='VEHICLE')", dispatchId);
                }
            }
        });
    }

    private static double haversineM(double lat1, double lon1, double lat2, double lon2) {
        double R    = 6_371_000.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a    = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                    + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                    * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private static long   toLong  (Map<String, Object> m, String k) { return ((Number) m.get(k)).longValue(); }
    private static double toDouble(Map<String, Object> m, String k) { return ((Number) m.get(k)).doubleValue(); }
}
