package com.mpscc.dispatch.service;

import com.mpscc.dispatch.model.DispatchRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Automatically dispatches resources to WAITING incidents based on their age and priority.
 * Incidents are picked up 2–5 minutes after creation, creating a realistic ebb-and-flow.
 * Resource selection is intelligent: skills, distance, and crime type are all considered.
 */
@Service
public class AutoDispatchService {

    private static final Logger log = LoggerFactory.getLogger(AutoDispatchService.class);
    private static final Random RNG = new Random();

    private final JdbcTemplate jdbc;
    private final DispatchService dispatchService;
    private final IncidentPhrasesBank phrases;

    public AutoDispatchService(JdbcTemplate jdbc, DispatchService dispatchService,
                               IncidentPhrasesBank phrases) {
        this.jdbc = jdbc;
        this.dispatchService = dispatchService;
        this.phrases = phrases;
    }

    @Scheduled(fixedDelay = 12_000)
    public void autoDispatch() {
        List<Map<String, Object>> waiting = fetchWaiting();
        if (waiting.isEmpty()) return;

        for (Map<String, Object> row : waiting) {
            long incidentId   = toLong(row, "id");
            int  priority     = toInt(row, "priority");
            String crimeType  = str(row, "crime_type");
            boolean injuries  = bool(row, "injuries");
            boolean weapons   = bool(row, "weapons");
            boolean suspects  = bool(row, "suspects_on_scene");
            OffsetDateTime created = (OffsetDateTime) row.get("created_at");

            long ageSeconds = Duration.between(created, OffsetDateTime.now()).getSeconds();

            // Incidents younger than 2 minutes are never auto-dispatched
            if (ageSeconds < 120) continue;

            // Probabilistic dispatch window: 2–5 min with rising probability
            double chance;
            if (ageSeconds >= 300)      chance = 1.0;   // 5+ min: always dispatch
            else if (ageSeconds >= 240) chance = 0.85;  // 4–5 min
            else if (ageSeconds >= 180) chance = 0.55;  // 3–4 min
            else                        chance = 0.25;  // 2–3 min

            if (RNG.nextDouble() > chance) continue;

            tryDispatch(incidentId, priority, crimeType, injuries, weapons, suspects);
        }
    }

    public int dispatchNow(int maxCount) {
        List<Map<String, Object>> waiting = jdbc.queryForList("""
                SELECT id, priority, crime_type, injuries, weapons, suspects_on_scene, created_at
                FROM incidents
                WHERE status = 'WAITING'
                ORDER BY priority ASC, created_at ASC
                LIMIT ?
                """, maxCount);

        int dispatched = 0;
        for (Map<String, Object> row : waiting) {
            long incidentId  = toLong(row, "id");
            int  priority    = toInt(row, "priority");
            String crimeType = str(row, "crime_type");
            boolean injuries = bool(row, "injuries");
            boolean weapons  = bool(row, "weapons");
            boolean suspects = bool(row, "suspects_on_scene");
            try {
                tryDispatch(incidentId, priority, crimeType, injuries, weapons, suspects);
                dispatched++;
            } catch (Exception e) {
                log.warn("Batch dispatch failed for incident {}: {}", incidentId, e.getMessage());
            }
        }
        return dispatched;
    }

    private void tryDispatch(long incidentId, int priority, String crimeType,
                             boolean injuries, boolean weapons, boolean suspects) {
        try {
            // Determine the skill requirement for this crime
            String requiredSkill = requiredSkill(crimeType, priority, weapons, injuries);

            // Search radius scales with priority: P1 up to 10 km, P5 up to 1.5 km
            int radiusM = switch (priority) {
                case 1 -> 10_000;
                case 2 -> 6_000;
                case 3 -> 4_000;
                default -> 2_500;
            };

            Map<String, Object> suggestions = dispatchService.suggestResources(incidentId, requiredSkill, radiusM);
            List<Map<String, Object>> officers = asList(suggestions, "officers");
            List<Map<String, Object>> vehicles = asList(suggestions, "vehicles");

            // Widen to all skills if the specialist search returned nothing
            if (officers.isEmpty() && !requiredSkill.isEmpty()) {
                suggestions = dispatchService.suggestResources(incidentId, "", radiusM);
                officers    = asList(suggestions, "officers");
                vehicles    = asList(suggestions, "vehicles");
            }

            if (officers.isEmpty()) {
                log.debug("No available officers for incident {} — will retry next tick", incidentId);
                return;
            }

            // Decide how many officers and whether a vehicle is needed
            int officerCount = officerCount(priority, crimeType, suspects);
            officerCount = Math.min(officerCount, officers.size());

            boolean needVehicle = priority <= 3 || "ROAD_TRAFFIC_INCIDENT".equals(crimeType)
                                  || weapons || injuries;

            // Select resources — closest first (suggestResources already sorts by distance)
            List<Long> officerIds = new ArrayList<>();
            List<Long> vehicleIds = new ArrayList<>();

            for (int i = 0; i < officerCount; i++) {
                officerIds.add(toLong(officers.get(i), "id"));
            }
            if (needVehicle && !vehicles.isEmpty()) {
                vehicleIds.add(toLong(vehicles.get(0), "id"));
            }

            // Build a contextual dispatch note before committing the dispatch
            String dispatchNote = buildDispatchNote(priority, crimeType, officers.subList(0, officerCount),
                                                    needVehicle && !vehicles.isEmpty() ? vehicles.subList(0, 1) : List.of(),
                                                    requiredSkill);

            // Add the dispatch note first, then create the dispatch
            dispatchService.addNote(incidentId, "CAD Auto-Dispatch", dispatchNote, "DISPATCH");

            DispatchRequest req = new DispatchRequest();
            req.setIncidentId(incidentId);
            req.setOfficerIds(officerIds);
            req.setVehicleIds(vehicleIds);
            dispatchService.createDispatch(req);

            log.info("Auto-dispatched incident {} — {} officers, {} vehicles (skill={})",
                incidentId, officerIds.size(), vehicleIds.size(), requiredSkill.isEmpty() ? "any" : requiredSkill);

        } catch (Exception ex) {
            log.warn("Auto-dispatch failed for incident {}: {}", incidentId, ex.getMessage());
        }
    }

    // ── Intelligence: skill selection ────────────────────────────────────────

    private String requiredSkill(String crimeType, int priority, boolean weapons, boolean injuries) {
        if ("FIREARMS_INCIDENT".equals(crimeType))  return "FIREARMS";
        if (weapons && List.of("KNIFE_CRIME", "ROBBERY", "ASSAULT").contains(crimeType)) return "TASER";
        if (injuries && List.of("ASSAULT", "ROAD_TRAFFIC_INCIDENT", "DOMESTIC_VIOLENCE").contains(crimeType))
            return "FIRST_AID";
        if ("MENTAL_HEALTH".equals(crimeType))      return "MENTAL_HEALTH";
        if ("ROAD_TRAFFIC_INCIDENT".equals(crimeType)) return "ROADS_POLICING";
        if ("MISSING_PERSON".equals(crimeType))     return "SEARCH";
        return "";
    }

    private int officerCount(int priority, String crimeType, boolean suspects) {
        if ("FIREARMS_INCIDENT".equals(crimeType))  return 3;
        if (priority == 1)                           return 2;
        if (priority == 2)                           return suspects ? 2 : 2;
        if (priority == 3) {
            if (List.of("ROBBERY", "BURGLARY", "ASSAULT").contains(crimeType)) return suspects ? 2 : 1;
            return 1;
        }
        return 1;
    }

    // ── Dispatch note builder ────────────────────────────────────────────────

    private String buildDispatchNote(int priority, String crimeType,
                                     List<Map<String, Object>> officers,
                                     List<Map<String, Object>> vehicles,
                                     String skill) {
        StringBuilder sb = new StringBuilder();

        // Priority / resource summary line
        sb.append(String.format("P%d %s — resources allocated.", priority, crimeType.replace('_', ' ')));

        // Officer list with mode and ETA
        for (Map<String, Object> o : officers) {
            String name     = str(o, "name");
            String collar   = str(o, "collarNumber");
            String mode     = str(o, "mode");
            long   distM    = toLong(o, "distanceM");
            int    etaMin   = etaMinutes(distM, mode);
            String rank     = str(o, "rank");
            String modeLabel = switch (mode) {
                case "CAR"       -> "patrol car";
                case "MOTORBIKE" -> "motorbike";
                case "PUSHBIKE"  -> "pushbike";
                case "DOG_CAR"   -> "dog unit";
                default          -> "foot patrol";
            };
            sb.append(String.format(" %s %s [%s] responding by %s — ETA %d min.", rank, name, collar, modeLabel, etaMin));
        }

        // Vehicle
        for (Map<String, Object> v : vehicles) {
            sb.append(String.format(" Vehicle %s (%s) allocated.", str(v, "identifier"), str(v, "type")));
        }

        // Skill note
        if (!skill.isEmpty()) {
            sb.append(" ").append(skillNote(skill));
        }

        // Crime-specific context
        String ctx = phrases.crimeDispatchContext(crimeType);
        if (!ctx.isBlank()) sb.append(ctx);

        return sb.toString();
    }

    private String skillNote(String skill) {
        return switch (skill) {
            case "FIREARMS"     -> "Armed response vehicle included in deployment.";
            case "TASER"        -> "Taser-trained officer deployed given weapon reported.";
            case "FIRST_AID"    -> "First-aid trained officer deployed given injuries reported.";
            case "MENTAL_HEALTH"-> "Mental health-trained officer deployed.";
            case "ROADS_POLICING" -> "Roads policing unit included.";
            case "SEARCH"       -> "POLSA-trained search officer deployed.";
            default             -> "";
        };
    }

    private int etaMinutes(long distanceM, String mode) {
        double speedMs = switch (mode) {
            case "CAR", "VAN", "DOG_CAR" -> 8.3;
            case "MOTORBIKE"             -> 11.1;
            case "PUSHBIKE"              -> 5.6;
            default                      -> 1.4;
        };
        return Math.max(1, (int) Math.ceil(distanceM / speedMs / 60));
    }

    // ── Query helpers ────────────────────────────────────────────────────────

    private List<Map<String, Object>> fetchWaiting() {
        return jdbc.queryForList("""
                SELECT id, priority, crime_type, injuries, weapons, suspects_on_scene, created_at
                FROM incidents
                WHERE status = 'WAITING'
                ORDER BY priority ASC, created_at ASC
                LIMIT 30
                """);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asList(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v instanceof List<?> ? (List<Map<String, Object>>) v : List.of();
    }

    private static long    toLong(Map<String, Object> m, String k) { return ((Number)  m.get(k)).longValue(); }
    private static int     toInt (Map<String, Object> m, String k) { return ((Number)  m.get(k)).intValue(); }
    private static boolean bool  (Map<String, Object> m, String k) { Object v = m.get(k); return v instanceof Boolean b && b; }
    private static String  str   (Map<String, Object> m, String k) { Object v = m.get(k); return v != null ? v.toString() : ""; }
}
