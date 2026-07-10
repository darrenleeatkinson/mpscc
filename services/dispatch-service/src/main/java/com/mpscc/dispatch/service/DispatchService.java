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

    private final JdbcTemplate jdbc;
    private final DispatchRepository dispatches;
    private final DispatchResourceRepository resources;

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
                    m.put("id",         rs.getLong("id"));
                    m.put("reference",  rs.getString("reference"));
                    m.put("priority",   rs.getInt("priority"));
                    m.put("status",     rs.getString("status"));
                    m.put("crimeType",  rs.getString("crime_type"));
                    m.put("address",    rs.getString("address"));
                    m.put("postcode",   rs.getString("postcode"));
                    m.put("latitude",   rs.getDouble("latitude"));
                    m.put("longitude",  rs.getDouble("longitude"));
                    m.put("createdAt",  rs.getObject("created_at", OffsetDateTime.class));
                    return m;
                });
    }

    // ── resource suggestion via PostGIS distance ───────────────────────────

    public Map<String, Object> suggestResources(long incidentId) {
        Map<String, Object> inc = jdbc.queryForMap(
                "SELECT latitude, longitude FROM incidents WHERE id = ?", incidentId);
        double lat = ((Number) inc.get("latitude")).doubleValue();
        double lon = ((Number) inc.get("longitude")).doubleValue();

        List<Map<String, Object>> officers = jdbc.query("""
                SELECT o.id, o.collar_number, o.forename, o.surname, o.rank,
                       o.status, o.is_firearms, o.default_mode,
                       s.name AS station_name, s.borough,
                       ROUND(ST_Distance(s.location,
                           ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography)::numeric, 0) AS distance_m
                FROM officers o
                JOIN stations s ON s.id = o.home_station
                WHERE o.status NOT IN ('DISPATCHED', 'ON_SCENE')
                ORDER BY distance_m
                LIMIT 15
                """,
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
                    m.put("distanceM",   rs.getLong("distance_m"));
                    return m;
                },
                lon, lat);  // ST_MakePoint(lon, lat)

        List<Map<String, Object>> vehicles = jdbc.query("""
                SELECT v.id, v.identifier, v.type, v.seats,
                       s.name AS station_name, s.borough,
                       ROUND(ST_Distance(s.location,
                           ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography)::numeric, 0) AS distance_m
                FROM vehicles v
                JOIN stations s ON s.id = v.home_station
                WHERE v.status NOT IN ('DISPATCHED', 'ON_SCENE')
                  AND v.type IN ('CAR', 'VAN')
                ORDER BY distance_m
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
                    m.put("distanceM",   rs.getLong("distance_m"));
                    return m;
                },
                lon, lat);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("officers", officers);
        result.put("vehicles", vehicles);
        return result;
    }

    // ── create dispatch ────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> createDispatch(DispatchRequest req) {
        // Verify incident exists and is still waiting
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT reference, priority FROM incidents WHERE id = ? AND status = 'WAITING'",
                req.getIncidentId());
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Incident not found or already dispatched");
        }
        Map<String, Object> inc = rows.get(0);

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
                    "SELECT collar_number, forename, surname FROM officers WHERE id = ?", officerId);
            if (o.isEmpty()) continue;
            DispatchResource r = new DispatchResource();
            r.setDispatchId(dispatchId);
            r.setResourceType("OFFICER");
            r.setResourceId(officerId);
            r.setResourceRef((String) o.get(0).get("collar_number"));
            r.setResourceName(o.get(0).get("forename") + " " + o.get(0).get("surname"));
            r.setAssignedAt(OffsetDateTime.now(LONDON));
            resources.save(r);
            jdbc.update("UPDATE officers SET status = 'DISPATCHED' WHERE id = ?", officerId);
            Map<String, Object> a = new LinkedHashMap<>();
            a.put("type", "OFFICER");
            a.put("ref",  r.getResourceRef());
            a.put("name", r.getResourceName());
            assigned.add(a);
        }

        for (Long vehicleId : req.getVehicleIds()) {
            List<Map<String, Object>> v = jdbc.queryForList(
                    "SELECT identifier, type FROM vehicles WHERE id = ?", vehicleId);
            if (v.isEmpty()) continue;
            DispatchResource r = new DispatchResource();
            r.setDispatchId(dispatchId);
            r.setResourceType("VEHICLE");
            r.setResourceId(vehicleId);
            r.setResourceRef((String) v.get(0).get("identifier"));
            r.setResourceName((String) v.get(0).get("type"));
            r.setAssignedAt(OffsetDateTime.now(LONDON));
            resources.save(r);
            jdbc.update("UPDATE vehicles SET status = 'DISPATCHED' WHERE id = ?", vehicleId);
            Map<String, Object> a = new LinkedHashMap<>();
            a.put("type", "VEHICLE");
            a.put("ref",  r.getResourceRef());
            a.put("name", r.getResourceName());
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
            // Get current incident details (address, lat/lon, crimeType may be richer than when dispatched)
            List<Map<String, Object>> incRows = jdbc.queryForList(
                    "SELECT address, postcode, latitude, longitude, crime_type, status FROM incidents WHERE id = ?",
                    d.getIncidentId());

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",          d.getId());
            m.put("incidentId",  d.getIncidentId());
            m.put("incidentRef", d.getIncidentRef());
            m.put("priority",    d.getPriority());
            m.put("status",      d.getStatus());
            m.put("createdAt",   d.getCreatedAt());
            m.put("onSceneAt",   d.getOnSceneAt());
            m.put("resolvedAt",  d.getResolvedAt());

            if (!incRows.isEmpty()) {
                Map<String, Object> inc = incRows.get(0);
                m.put("address",   inc.get("address"));
                m.put("postcode",  inc.get("postcode"));
                m.put("latitude",  inc.get("latitude"));
                m.put("longitude", inc.get("longitude"));
                m.put("crimeType", inc.get("crime_type"));
            }

            List<DispatchResource> res = resources.findByDispatchId(d.getId());
            List<Map<String, Object>> resList = res.stream().map(r -> {
                Map<String, Object> rm = new LinkedHashMap<>();
                rm.put("type", r.getResourceType());
                rm.put("ref",  r.getResourceRef());
                rm.put("name", r.getResourceName());
                return rm;
            }).toList();
            m.put("resources", resList);

            result.add(m);
        }
        return result;
    }

    // ── status transitions ─────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> markOnScene(long dispatchId) {
        Dispatch d = dispatches.findById(dispatchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        d.setStatus("ON_SCENE");
        d.setOnSceneAt(OffsetDateTime.now(LONDON));
        dispatches.save(d);

        jdbc.update("UPDATE incidents SET status = 'ON_SCENE' WHERE id = ?", d.getIncidentId());
        jdbc.update("""
                UPDATE officers SET status = 'ON_SCENE'
                WHERE id IN (SELECT resource_id FROM dispatch_resources
                             WHERE dispatch_id = ? AND resource_type = 'OFFICER')
                """, dispatchId);
        jdbc.update("""
                UPDATE vehicles SET status = 'ON_SCENE'
                WHERE id IN (SELECT resource_id FROM dispatch_resources
                             WHERE dispatch_id = ? AND resource_type = 'VEHICLE')
                """, dispatchId);

        return Map.of("id", d.getId(), "status", d.getStatus(), "onSceneAt", d.getOnSceneAt());
    }

    @Transactional
    public Map<String, Object> resolve(long dispatchId) {
        Dispatch d = dispatches.findById(dispatchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        d.setStatus("RESOLVED");
        d.setResolvedAt(OffsetDateTime.now(LONDON));
        dispatches.save(d);

        jdbc.update("UPDATE incidents SET status = 'RESOLVED' WHERE id = ?", d.getIncidentId());
        jdbc.update("""
                UPDATE officers SET status = 'ON_DUTY'
                WHERE id IN (SELECT resource_id FROM dispatch_resources
                             WHERE dispatch_id = ? AND resource_type = 'OFFICER')
                """, dispatchId);
        jdbc.update("""
                UPDATE vehicles SET status = 'AVAILABLE'
                WHERE id IN (SELECT resource_id FROM dispatch_resources
                             WHERE dispatch_id = ? AND resource_type = 'VEHICLE')
                """, dispatchId);

        return Map.of("id", d.getId(), "status", d.getStatus(), "resolvedAt", d.getResolvedAt());
    }
}
