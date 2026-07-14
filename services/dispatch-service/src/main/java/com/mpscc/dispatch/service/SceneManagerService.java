package com.mpscc.dispatch.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Manages the lifecycle of incidents once resources are on scene.
 * - Adds arrival notes when dispatches transition to ON_SCENE
 * - Adds periodic scene update notes while on scene
 * - Resolves incidents after an appropriate dwell time with realistic outcome notes
 * - Adds serious-crime investigation addenda for P1 / high-severity crimes
 *
 * Runs every 10 seconds to provide a visible stream of activity in the UI.
 */
@Service
public class SceneManagerService {

    private static final Logger log = LoggerFactory.getLogger(SceneManagerService.class);
    private static final Random RNG = new Random();

    private final JdbcTemplate jdbc;
    private final DispatchService dispatchService;
    private final IncidentPhrasesBank phrases;

    public SceneManagerService(JdbcTemplate jdbc, DispatchService dispatchService,
                               IncidentPhrasesBank phrases) {
        this.jdbc = jdbc;
        this.dispatchService = dispatchService;
        this.phrases = phrases;
    }

    @Scheduled(fixedDelay = 10_000)
    @Transactional
    public void tick() {
        addArrivalNotes();
        addSceneUpdateNotes();
        resolveMaturedScenes();
    }

    // ── 1. Add arrival note for newly ON_SCENE dispatches ────────────────────

    private void addArrivalNotes() {
        List<Map<String, Object>> arrivals = jdbc.queryForList("""
                SELECT d.id AS dispatch_id, d.incident_id, d.on_scene_at,
                       i.crime_type, i.priority
                FROM dispatches d
                JOIN incidents i ON i.id = d.incident_id
                WHERE d.status = 'ON_SCENE'
                  AND d.on_scene_at IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM incident_notes n
                      WHERE n.incident_id = d.incident_id
                        AND n.note_type = 'ON_SCENE'
                  )
                LIMIT 10
                """);

        for (Map<String, Object> row : arrivals) {
            long incidentId = toLong(row, "incident_id");
            String author   = resolveAuthor(row, "ON_SCENE");
            String note     = phrases.onSceneArrival();
            dispatchService.addNote(incidentId, author, note, "ON_SCENE");
            log.debug("Arrival note added for incident {}", incidentId);
        }
    }

    // ── 2. Add scene update notes for ON_SCENE dispatches ────────────────────

    private void addSceneUpdateNotes() {
        List<Map<String, Object>> onScene = jdbc.queryForList("""
                SELECT d.id AS dispatch_id, d.incident_id, d.on_scene_at,
                       i.crime_type, i.priority,
                       EXTRACT(EPOCH FROM (now() - d.on_scene_at)) AS seconds_on_scene,
                       (SELECT MAX(n.created_at) FROM incident_notes n
                        WHERE n.incident_id = d.incident_id
                          AND n.note_type IN ('ON_SCENE','SCENE_UPDATE')) AS last_update
                FROM dispatches d
                JOIN incidents i ON i.id = d.incident_id
                WHERE d.status = 'ON_SCENE'
                  AND d.on_scene_at IS NOT NULL
                LIMIT 20
                """);

        for (Map<String, Object> row : onScene) {
            long   incidentId    = toLong(row, "incident_id");
            double secondsOnScene = toDouble(row, "seconds_on_scene");
            Object lastUpdate    = row.get("last_update");
            int    priority      = toInt(row, "priority");

            // Only add scene update after at least 60 seconds on scene
            if (secondsOnScene < 60) continue;

            // Throttle: max one update per 90–180 seconds
            if (lastUpdate instanceof OffsetDateTime lu) {
                long secondsSinceUpdate = Duration.between(lu, OffsetDateTime.now()).getSeconds();
                int minGap = 90 + RNG.nextInt(90); // 90–180 seconds between updates
                if (secondsSinceUpdate < minGap) continue;
            }

            // Probabilistic: don't update every tick, create bursts
            if (RNG.nextDouble() > 0.35) continue;

            String author = resolveAuthor(row, "SCENE_UPDATE");
            dispatchService.addNote(incidentId, author, phrases.sceneUpdate(), "SCENE_UPDATE");
            log.debug("Scene update added for incident {}", incidentId);
        }
    }

    // ── 3. Resolve incidents that have been on scene long enough ─────────────

    private void resolveMaturedScenes() {
        List<Map<String, Object>> candidates = jdbc.queryForList("""
                SELECT d.id AS dispatch_id, d.incident_id, d.on_scene_at,
                       i.crime_type, i.priority, i.injuries, i.weapons,
                       EXTRACT(EPOCH FROM (now() - d.on_scene_at)) AS seconds_on_scene
                FROM dispatches d
                JOIN incidents i ON i.id = d.incident_id
                WHERE d.status = 'ON_SCENE'
                  AND d.on_scene_at IS NOT NULL
                LIMIT 20
                """);

        for (Map<String, Object> row : candidates) {
            long   dispatchId    = toLong(row, "dispatch_id");
            long   incidentId    = toLong(row, "incident_id");
            int    priority      = toInt(row, "priority");
            String crimeType     = str(row, "crime_type");
            boolean injuries     = bool(row, "injuries");
            double secondsOnScene = toDouble(row, "seconds_on_scene");

            int minSeconds = phrases.minOnSceneSeconds(priority, crimeType);
            int maxSeconds = phrases.maxOnSceneSeconds(priority, crimeType);

            if (secondsOnScene < minSeconds) continue;

            // Probabilistic: once past minimum, chance rises toward 100% at max
            double progressFraction = Math.min(1.0,
                (secondsOnScene - minSeconds) / (double)(maxSeconds - minSeconds));
            double resolveChance = 0.15 + (progressFraction * 0.75); // 15% → 90%

            // Force resolution past max time
            if (secondsOnScene >= maxSeconds) resolveChance = 1.0;

            if (RNG.nextDouble() > resolveChance) continue;

            resolveIncident(dispatchId, incidentId, priority, crimeType, injuries);
        }
    }

    private void resolveIncident(long dispatchId, long incidentId, int priority,
                                  String crimeType, boolean injuries) {
        try {
            String outcome       = phrases.pickOutcome(crimeType, priority, injuries);
            String resolutionNote = phrases.resolutionPhrase(outcome, crimeType, injuries);
            String author        = resolveAuthorByPriority(priority);

            dispatchService.addNote(incidentId, author, resolutionNote, "RESOLUTION");

            // For serious crimes, add an investigation addendum
            if (phrases.isSerious(crimeType, priority)) {
                dispatchService.addNote(incidentId, "CID Duty Inspector",
                    phrases.seriousCrimeAddendum(), "INVESTIGATION");
            }

            dispatchService.resolve(dispatchId);

            log.info("Auto-resolved dispatch {} (incident {}) — outcome: {} crime: {}",
                dispatchId, incidentId, outcome, crimeType);

        } catch (Exception ex) {
            log.warn("Failed to auto-resolve dispatch {}: {}", dispatchId, ex.getMessage());
        }
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private String resolveAuthor(Map<String, Object> row, String phase) {
        int priority = toInt(row, "priority");
        return resolveAuthorByPriority(priority);
    }

    private String resolveAuthorByPriority(int priority) {
        if (priority == 1) return "Inspector (Gold)";
        if (priority == 2) return "Sergeant on scene";
        return "PC on scene";
    }

    private static long   toLong  (Map<String, Object> m, String k) { return ((Number) m.get(k)).longValue(); }
    private static int    toInt   (Map<String, Object> m, String k) { return ((Number) m.get(k)).intValue(); }
    private static double toDouble(Map<String, Object> m, String k) { return ((Number) m.get(k)).doubleValue(); }
    private static boolean bool   (Map<String, Object> m, String k) { Object v = m.get(k); return v instanceof Boolean b && b; }
    private static String  str    (Map<String, Object> m, String k) { Object v = m.get(k); return v != null ? v.toString() : ""; }
}
