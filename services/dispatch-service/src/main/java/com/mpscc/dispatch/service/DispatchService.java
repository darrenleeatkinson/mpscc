package com.mpscc.dispatch.service;

import com.mpscc.dispatch.domain.Dispatch;
import com.mpscc.dispatch.domain.DispatchResource;
import com.mpscc.dispatch.model.DispatchRequest;
import com.mpscc.dispatch.repository.DispatchRepository;
import com.mpscc.dispatch.repository.DispatchResourceRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.*;

@Service
public class DispatchService {

    private static final ZoneId LONDON = ZoneId.of("Europe/London");

    final JdbcTemplate jdbc;
    final DispatchRepository dispatches;
    final DispatchResourceRepository resources;

    public DispatchService(JdbcTemplate jdbc,
                           DispatchRepository dispatches,
                           DispatchResourceRepository resources) {
        this.jdbc = jdbc;
        this.dispatches = dispatches;
        this.resources = resources;
    }

    // ── waiting incidents ─────────────────────────────────────────────────

    public List<Map<String, Object>> waitingIncidents() {
        return jdbc.query("""
                SELECT id, reference, priority, status, crime_type,
                       address, postcode, latitude, longitude, created_at
                FROM incidents
                WHERE status = 'WAITING'
                ORDER BY priority ASC, created_at ASC
                """,
                (rs, n) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",        rs.getLong("id"));
                    m.put("reference", rs.getString("reference"));
                    m.put("priority",  rs.getInt("priority"));
                    m.put("status",    rs.getString("status"));
                    m.put("crimeType", rs.getString("crime_type"));
                    m.put("address",   rs.getString("address"));
                    m.put("postcode",  rs.getString("postcode"));
                    m.put("latitude",  rs.getDouble("latitude"));
                    m.put("longitude", rs.getDouble("longitude"));
                    m.put("createdAt", rs.getObject("created_at", OffsetDateTime.class));
                    return m;
                });
    }

    // ── resource suggestion (skill + radius filter) ────────────────────────

    public Map<String, Object> suggestResources(long incidentId, String skill, int radius) {
        Map<String, Object> inc = jdbc.queryForMap(
                "SELECT latitude, longitude FROM incidents WHERE id = ?", incidentId);
        double lat = ((Number) inc.get("latitude")).doubleValue();
        double lon = ((Number) inc.get("longitude")).doubleValue();

        // Officers — conditional skill join
        StringBuilder offSql = new StringBuilder("""
                SELECT sub.* FROM (
                    SELECT o.id, o.collar_number, o.forename, o.surname, o.rank,
                           o.status, o.is_firearms, o.default_mode,
                           s.name AS station_name, s.borough,
                           ST_Y(s.location::geometry) AS station_lat,
                           ST_X(s.location::geometry) AS station_lon,
                           ROUND(ST_Distance(s.location,
                               ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography)::numeric, 0) AS distance_m
                    FROM officers o
                    JOIN stations s ON s.id = o.home_station
                    WHERE o.status NOT IN ('DISPATCHED', 'ON_SCENE')
                """);
        List<Object> offParams = new ArrayList<>(List.of(lon, lat));
        if (skill != null && !skill.isBlank()) {
            offSql.append("""
                        AND o.id IN (SELECT os.officer_id FROM officer_skills os
                                     JOIN skills sk ON sk.id = os.skill_id WHERE sk.code = ?)
                    """);
            offParams.add(skill.toUpperCase());
        }
        offSql.append(") sub WHERE sub.distance_m <= ? ORDER BY sub.distance_m LIMIT 20");
        offParams.add((long) radius);

        List<Map<String, Object>> officers = jdbc.query(offSql.toString(),
                (rs, n) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",          rs.getLong("id"));
                    m.put("collarNumber",rs.getString("collar_number"));
                    m.put("name",        rs.getString("forename") + " " + rs.getString("surname"));
                    m.put("rank",        rs.getString("rank"));
                    m.put("status",      rs.getString("status"));
                    m.put("firearms",    rs.getBoolean("is_firearms"));
                    m.put("mode",        rs.getString("default_mode"));
                    m.put("stationName", rs.getString("station_name"));
                    m.put("borough",     rs.getString("borough"));
                    m.put("lat",         rs.getDouble("station_lat"));
                    m.put("lon",         rs.getDouble("station_lon"));
                    m.put("distanceM",   rs.getLong("distance_m"));
                    return m;
                },
                offParams.toArray());

        // Vehicles — CAR and VAN only for dispatch
        List<Map<String, Object>> vehicles = jdbc.query("""
                SELECT sub.* FROM (
                    SELECT v.id, v.identifier, v.type, v.seats,
                           s.name AS station_name, s.borough,
                           ST_Y(s.location::geometry) AS station_lat,
                           ST_X(s.location::geometry) AS station_lon,
                           ROUND(ST_Distance(s.location,
                               ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography)::numeric, 0) AS distance_m
                    FROM vehicles v
                    JOIN stations s ON s.id = v.home_station
                    WHERE v.status NOT IN ('DISPATCHED', 'ON_SCENE')
                      AND v.type IN ('CAR','VAN')
                ) sub
                WHERE sub.distance_m <= ?
                ORDER BY sub.distance_m
                LIMIT 10
                """,
                (rs, n) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",          rs.getLong("id"));
                    m.put("identifier",  rs.getString("identifier"));
                    m.put("type",        rs.getString("type"));
                    m.put("seats",       rs.getInt("seats"));
                    m.put("stationName", rs.getString("station_name"));
                    m.put("borough",     rs.getString("borough"));
                    m.put("lat",         rs.getDouble("station_lat"));
                    m.put("lon",         rs.getDouble("station_lon"));
                    m.put("distanceM",   rs.getLong("distance_m"));
                    return m;
                },
                lon, lat, (long) radius);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("officers", officers);
        result.put("vehicles", vehicles);
        return result;
    }

    // ── create dispatch ────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> createDispatch(DispatchRequest req) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT reference, priority, latitude, longitude FROM incidents WHERE id = ? AND status = 'WAITING'",
                req.getIncidentId());
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Incident not found or already dispatched");
        }
        Map<String, Object> inc = rows.get(0);
        double incLat = ((Number) inc.get("latitude")).doubleValue();
        double incLon = ((Number) inc.get("longitude")).doubleValue();

        Dispatch d = new Dispatch();
        d.setIncidentId(req.getIncidentId());
        d.setIncidentRef((String) inc.get("reference"));
        d.setPriority((Integer) inc.get("priority"));
        d.setStatus("ACTIVE");
        d.setCreatedAt(OffsetDateTime.now(LONDON));
        d = dispatches.save(d);
        final long dispatchId = d.getId();

        List<Map<String, Object>> assigned = new ArrayList<>();

        for (Long officerId : req.getOfficerIds()) {
            List<Map<String, Object>> o = jdbc.queryForList(
                    """
                    SELECT o.collar_number, o.forename, o.surname, o.default_mode,
                           ST_Y(s.location::geometry) AS slat, ST_X(s.location::geometry) AS slon
                    FROM officers o JOIN stations s ON s.id = o.home_station WHERE o.id = ?
                    """, officerId);
            if (o.isEmpty()) continue;

            DispatchResource r = new DispatchResource();
            r.setDispatchId(dispatchId);
            r.setResourceType("OFFICER");
            r.setResourceId(officerId);
            r.setResourceRef((String) o.get(0).get("collar_number"));
            r.setResourceName(o.get(0).get("forename") + " " + o.get(0).get("surname"));
            r.setMode(officerMode((String) o.get(0).get("default_mode")));
            r.setCurrentLat(((Number) o.get(0).get("slat")).doubleValue());
            r.setCurrentLon(((Number) o.get(0).get("slon")).doubleValue());
            r.setTargetLat(incLat);
            r.setTargetLon(incLon);
            r.setAssignedAt(OffsetDateTime.now(LONDON));
            resources.save(r);
            jdbc.update("UPDATE officers SET status = 'DISPATCHED' WHERE id = ?", officerId);

            Map<String, Object> a = new LinkedHashMap<>();
            a.put("type", "OFFICER");
            a.put("ref",  r.getResourceRef());
            a.put("name", r.getResourceName());
            a.put("mode", r.getMode());
            assigned.add(a);
        }

        for (Long vehicleId : req.getVehicleIds()) {
            List<Map<String, Object>> v = jdbc.queryForList(
                    """
                    SELECT v.identifier, v.type,
                           ST_Y(s.location::geometry) AS slat, ST_X(s.location::geometry) AS slon
                    FROM vehicles v JOIN stations s ON s.id = v.home_station WHERE v.id = ?
                    """, vehicleId);
            if (v.isEmpty()) continue;

            DispatchResource r = new DispatchResource();
            r.setDispatchId(dispatchId);
            r.setResourceType("VEHICLE");
            r.setResourceId(vehicleId);
            r.setResourceRef((String) v.get(0).get("identifier"));
            r.setResourceName((String) v.get(0).get("type"));
            r.setMode((String) v.get(0).get("type"));
            r.setCurrentLat(((Number) v.get(0).get("slat")).doubleValue());
            r.setCurrentLon(((Number) v.get(0).get("slon")).doubleValue());
            r.setTargetLat(incLat);
            r.setTargetLon(incLon);
            r.setAssignedAt(OffsetDateTime.now(LONDON));
            resources.save(r);
            jdbc.update("UPDATE vehicles SET status = 'DISPATCHED' WHERE id = ?", vehicleId);

            Map<String, Object> a = new LinkedHashMap<>();
            a.put("type", "VEHICLE");
            a.put("ref",  r.getResourceRef());
            a.put("name", r.getResourceName());
            a.put("mode", r.getMode());
            assigned.add(a);
        }

        jdbc.update("UPDATE incidents SET status = 'DISPATCHED' WHERE id = ?", req.getIncidentId());

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("id",          d.getId());
        resp.put("incidentId",  d.getIncidentId());
        resp.put("incidentRef", d.getIncidentRef());
        resp.put("priority",    d.getPriority());
        resp.put("status",      d.getStatus());
        resp.put("createdAt",   d.getCreatedAt());
        resp.put("resources",   assigned);
        return resp;
    }

    // ── active dispatches ──────────────────────────────────────────────────

    public List<Map<String, Object>> activeDispatches() {
        List<Dispatch> active = dispatches.findActive();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Dispatch d : active) {
            List<Map<String, Object>> incRows = jdbc.queryForList(
                    "SELECT address, postcode, latitude, longitude, crime_type FROM incidents WHERE id = ?",
                    d.getIncidentId());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",          d.getId());
            m.put("incidentId",  d.getIncidentId());
            m.put("incidentRef", d.getIncidentRef());
            m.put("priority",    d.getPriority());
            m.put("status",      d.getStatus());
            m.put("createdAt",   d.getCreatedAt());
            m.put("onSceneAt",   d.getOnSceneAt());
            if (!incRows.isEmpty()) {
                Map<String, Object> inc = incRows.get(0);
                m.put("address",   inc.get("address"));
                m.put("postcode",  inc.get("postcode"));
                m.put("latitude",  inc.get("latitude"));
                m.put("longitude", inc.get("longitude"));
                m.put("crimeType", inc.get("crime_type"));
            }
            List<DispatchResource> res = resources.findByDispatchId(d.getId());
            m.put("resources", res.stream().map(r -> {
                Map<String, Object> rm = new LinkedHashMap<>();
                rm.put("type", r.getResourceType());
                rm.put("ref",  r.getResourceRef());
                rm.put("name", r.getResourceName());
                rm.put("mode", r.getMode());
                return rm;
            }).toList());
            result.add(m);
        }
        return result;
    }

    // ── moving resource positions (for live map updates) ──────────────────

    public List<Map<String, Object>> movingResources() {
        return jdbc.query("""
                SELECT dr.id, dr.resource_type, dr.resource_ref, dr.resource_name,
                       dr.mode, dr.current_lat, dr.current_lon, dr.target_lat, dr.target_lon,
                       d.status AS dispatch_status, d.incident_id,
                       dr.assigned_at, d.created_at AS dispatch_created_at, d.on_scene_at
                FROM dispatch_resources dr
                JOIN dispatches d ON d.id = dr.dispatch_id
                WHERE d.status IN ('ACTIVE','ON_SCENE')
                  AND dr.current_lat IS NOT NULL
                """,
                (rs, n) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",                "r-" + rs.getLong("id"));
                    m.put("resourceType",      rs.getString("resource_type"));
                    m.put("ref",               rs.getString("resource_ref"));
                    m.put("name",              rs.getString("resource_name"));
                    m.put("mode",              rs.getString("mode"));
                    m.put("lat",               rs.getDouble("current_lat"));
                    m.put("lon",               rs.getDouble("current_lon"));
                    m.put("targetLat",         rs.getDouble("target_lat"));
                    m.put("targetLon",         rs.getDouble("target_lon"));
                    m.put("dispatchStatus",    rs.getString("dispatch_status"));
                    m.put("incidentId",        rs.getLong("incident_id"));
                    m.put("assignedAt",        rs.getObject("assigned_at", OffsetDateTime.class));
                    m.put("dispatchCreatedAt", rs.getObject("dispatch_created_at", OffsetDateTime.class));
                    m.put("onSceneAt",         rs.getObject("on_scene_at", OffsetDateTime.class));
                    return m;
                });
    }

    // ── all resources within map bounds (free + dispatched) ───────────────

    public List<Map<String, Object>> allResources(double latMin, double lngMin, double latMax, double lngMax) {
        List<Map<String, Object>> result = new ArrayList<>();

        // Free vehicles (AVAILABLE) whose home station is within bounds
        result.addAll(jdbc.query("""
                SELECT 'v-' || v.id       AS id,
                       'VEHICLE'           AS resource_type,
                       v.identifier        AS resource_ref,
                       v.type              AS resource_name,
                       v.type              AS mode,
                       ST_Y(s.location::geometry) AS lat,
                       ST_X(s.location::geometry) AS lon
                FROM vehicles v
                JOIN stations s ON s.id = v.home_station
                WHERE v.status = 'AVAILABLE'
                  AND ST_X(s.location::geometry) BETWEEN ? AND ?
                  AND ST_Y(s.location::geometry) BETWEEN ? AND ?
                LIMIT 800
                """,
                (rs, n) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",                rs.getString("id"));
                    m.put("resourceType",      rs.getString("resource_type"));
                    m.put("ref",               rs.getString("resource_ref"));
                    m.put("name",              rs.getString("resource_name"));
                    m.put("mode",              rs.getString("mode"));
                    m.put("lat",               rs.getDouble("lat"));
                    m.put("lon",               rs.getDouble("lon"));
                    m.put("targetLat",         null);
                    m.put("targetLon",         null);
                    m.put("dispatchStatus",    "FREE");
                    m.put("incidentId",        null);
                    m.put("assignedAt",        null);
                    m.put("dispatchCreatedAt", null);
                    m.put("onSceneAt",         null);
                    return m;
                },
                lngMin, lngMax, latMin, latMax));

        // Free officers (on patrol) whose home station is within bounds
        result.addAll(jdbc.query("""
                SELECT 'o-' || o.id       AS id,
                       'OFFICER'           AS resource_type,
                       o.collar_number     AS resource_ref,
                       o.forename || ' ' || o.surname AS resource_name,
                       COALESCE(o.default_mode, 'FOOT') AS mode,
                       ST_Y(s.location::geometry) AS lat,
                       ST_X(s.location::geometry) AS lon
                FROM officers o
                JOIN stations s ON s.id = o.home_station
                WHERE o.status NOT IN ('DISPATCHED', 'ON_SCENE')
                  AND ST_X(s.location::geometry) BETWEEN ? AND ?
                  AND ST_Y(s.location::geometry) BETWEEN ? AND ?
                LIMIT 3000
                """,
                (rs, n) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",                rs.getString("id"));
                    m.put("resourceType",      rs.getString("resource_type"));
                    m.put("ref",               rs.getString("resource_ref"));
                    m.put("name",              rs.getString("resource_name"));
                    m.put("mode",              rs.getString("mode"));
                    m.put("lat",               rs.getDouble("lat"));
                    m.put("lon",               rs.getDouble("lon"));
                    m.put("targetLat",         null);
                    m.put("targetLon",         null);
                    m.put("dispatchStatus",    "FREE");
                    m.put("incidentId",        null);
                    m.put("assignedAt",        null);
                    m.put("dispatchCreatedAt", null);
                    m.put("onSceneAt",         null);
                    return m;
                },
                lngMin, lngMax, latMin, latMax));

        // All dispatched/on-scene resources (no bounds filter — they can be anywhere en route)
        result.addAll(jdbc.query("""
                SELECT 'r-' || dr.id      AS id,
                       dr.resource_type,
                       dr.resource_ref,
                       dr.resource_name,
                       dr.mode,
                       dr.current_lat     AS lat,
                       dr.current_lon     AS lon,
                       dr.target_lat,
                       dr.target_lon,
                       dr.route_geojson,
                       d.status           AS dispatch_status,
                       d.incident_id,
                       dr.assigned_at,
                       d.created_at       AS dispatch_created_at,
                       d.on_scene_at
                FROM dispatch_resources dr
                JOIN dispatches d ON d.id = dr.dispatch_id
                WHERE d.status IN ('ACTIVE','ON_SCENE')
                  AND dr.current_lat IS NOT NULL
                """,
                (rs, n) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",                rs.getString("id"));
                    m.put("resourceType",      rs.getString("resource_type"));
                    m.put("ref",               rs.getString("resource_ref"));
                    m.put("name",              rs.getString("resource_name"));
                    m.put("mode",              rs.getString("mode"));
                    m.put("lat",               rs.getDouble("lat"));
                    m.put("lon",               rs.getDouble("lon"));
                    Object tLat = rs.getObject("target_lat"); Object tLon = rs.getObject("target_lon");
                    m.put("targetLat",         tLat != null ? ((Number)tLat).doubleValue() : null);
                    m.put("targetLon",         tLon != null ? ((Number)tLon).doubleValue() : null);
                    Object routeJson = rs.getObject("route_geojson");
                    m.put("routeGeojson",      routeJson != null ? routeJson.toString() : null);
                    m.put("dispatchStatus",    rs.getString("dispatch_status"));
                    m.put("incidentId",        rs.getLong("incident_id"));
                    m.put("assignedAt",        rs.getObject("assigned_at", OffsetDateTime.class));
                    m.put("dispatchCreatedAt", rs.getObject("dispatch_created_at", OffsetDateTime.class));
                    m.put("onSceneAt",         rs.getObject("on_scene_at", OffsetDateTime.class));
                    return m;
                }));

        return result;
    }

    // ── status transitions ─────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> markOnScene(long dispatchId) {
        Dispatch d = dispatches.findById(dispatchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if ("ON_SCENE".equals(d.getStatus())) return Map.of("id", d.getId(), "status", d.getStatus());
        d.setStatus("ON_SCENE");
        d.setOnSceneAt(OffsetDateTime.now(LONDON));
        dispatches.save(d);
        jdbc.update("UPDATE incidents SET status='ON_SCENE' WHERE id=?", d.getIncidentId());
        jdbc.update("UPDATE officers SET status='ON_SCENE' WHERE id IN (SELECT resource_id FROM dispatch_resources WHERE dispatch_id=? AND resource_type='OFFICER')", dispatchId);
        jdbc.update("UPDATE vehicles  SET status='ON_SCENE' WHERE id IN (SELECT resource_id FROM dispatch_resources WHERE dispatch_id=? AND resource_type='VEHICLE')", dispatchId);
        return Map.of("id", d.getId(), "status", d.getStatus(), "onSceneAt", d.getOnSceneAt());
    }

    @Transactional
    public Map<String, Object> resolve(long dispatchId) {
        Dispatch d = dispatches.findById(dispatchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        d.setStatus("RESOLVED");
        d.setResolvedAt(OffsetDateTime.now(LONDON));
        dispatches.save(d);
        jdbc.update("UPDATE incidents SET status='RESOLVED' WHERE id=?", d.getIncidentId());
        jdbc.update("UPDATE officers SET status='ON_DUTY'   WHERE id IN (SELECT resource_id FROM dispatch_resources WHERE dispatch_id=? AND resource_type='OFFICER')", dispatchId);
        jdbc.update("UPDATE vehicles  SET status='AVAILABLE' WHERE id IN (SELECT resource_id FROM dispatch_resources WHERE dispatch_id=? AND resource_type='VEHICLE')", dispatchId);
        return Map.of("id", d.getId(), "status", d.getStatus(), "resolvedAt", d.getResolvedAt());
    }

    // ── incident notes ─────────────────────────────────────────────────────

    public List<Map<String, Object>> listNotes(long incidentId) {
        return jdbc.query("""
                SELECT id, incident_id, dispatch_id, author, note_text, note_type, created_at
                FROM incident_notes
                WHERE incident_id = ?
                ORDER BY created_at ASC
                """,
                (rs, n) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",         rs.getLong("id"));
                    m.put("incidentId", rs.getLong("incident_id"));
                    m.put("dispatchId", rs.getObject("dispatch_id"));
                    m.put("author",     rs.getString("author"));
                    m.put("noteText",   rs.getString("note_text"));
                    m.put("noteType",   rs.getString("note_type"));
                    m.put("createdAt",  rs.getObject("created_at", OffsetDateTime.class));
                    return m;
                },
                incidentId);
    }

    public Map<String, Object> addNote(long incidentId, String author, String noteText, String noteType) {
        long id = jdbc.queryForObject("""
                INSERT INTO incident_notes (incident_id, author, note_text, note_type)
                VALUES (?, ?, ?, ?)
                RETURNING id
                """, Long.class, incidentId, author, noteText, noteType);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",         id);
        m.put("incidentId", incidentId);
        m.put("author",     author);
        m.put("noteText",   noteText);
        m.put("noteType",   noteType);
        m.put("createdAt",  OffsetDateTime.now());
        return m;
    }

    // ── route persistence ──────────────────────────────────────────────────

    public void saveRoute(long dispatchResourceId, String routeGeojson, int distanceM, int durationS) {
        jdbc.update("""
                UPDATE dispatch_resources
                SET route_geojson = ?::jsonb, route_distance_m = ?, route_duration_s = ?, route_saved_at = now()
                WHERE id = ?
                """,
                routeGeojson, distanceM, durationS, dispatchResourceId);
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private String officerMode(String defaultMode) {
        if (defaultMode == null) return "FOOT";
        return switch (defaultMode) {
            case "CAR","DOG_CAR" -> "CAR";
            case "MOTORBIKE"     -> "MOTORBIKE";
            default              -> "FOOT";
        };
    }
}
