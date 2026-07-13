package com.mpscc.dispatch.controller;

import com.mpscc.dispatch.model.DispatchRequest;
import com.mpscc.dispatch.service.DispatchService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/dispatch")
public class DispatchController {

    private final DispatchService service;

    public DispatchController(DispatchService service) {
        this.service = service;
    }

    @GetMapping("/incidents/waiting")
    public List<Map<String, Object>> waiting() {
        return service.waitingIncidents();
    }

    @GetMapping("/incidents/{incidentId}/resources")
    public Map<String, Object> resources(
            @PathVariable long incidentId,
            @RequestParam(defaultValue = "")     String skill,
            @RequestParam(defaultValue = "1000") int    radius) {
        return service.suggestResources(incidentId, skill, radius);
    }

    @GetMapping("/resources/moving")
    public List<Map<String, Object>> movingResources() {
        return service.movingResources();
    }

    @GetMapping("/resources/all")
    public List<Map<String, Object>> allResources(
            @RequestParam(defaultValue = "51.2") double latMin,
            @RequestParam(defaultValue = "-0.6") double lngMin,
            @RequestParam(defaultValue = "51.8") double latMax,
            @RequestParam(defaultValue = "0.4")  double lngMax) {
        return service.allResources(latMin, lngMin, latMax, lngMax);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> dispatch(@RequestBody DispatchRequest req) {
        return ResponseEntity.status(201).body(service.createDispatch(req));
    }

    @GetMapping
    public List<Map<String, Object>> active() {
        return service.activeDispatches();
    }

    @PostMapping("/{id}/on-scene")
    public Map<String, Object> onScene(@PathVariable long id) {
        return service.markOnScene(id);
    }

    @PostMapping("/{id}/resolve")
    public Map<String, Object> resolve(@PathVariable long id) {
        return service.resolve(id);
    }

    @PostMapping("/{id}/add-resources")
    public List<Map<String, Object>> addResources(
            @PathVariable long id,
            @RequestBody Map<String, List<Long>> body) {
        List<Long> officers = body.getOrDefault("officerIds", List.of());
        List<Long> vehicles = body.getOrDefault("vehicleIds", List.of());
        return service.addResourcesToDispatch(id, officers, vehicles);
    }

    @DeleteMapping("/{id}/resources/{drId}")
    public ResponseEntity<Void> removeResource(
            @PathVariable long id,
            @PathVariable long drId) {
        service.removeResourceFromDispatch(id, drId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/incidents/{incidentId}/notes")
    public List<Map<String, Object>> listNotes(@PathVariable long incidentId) {
        return service.listNotes(incidentId);
    }

    @PostMapping("/incidents/{incidentId}/notes")
    public Map<String, Object> addNote(
            @PathVariable long incidentId,
            @RequestBody Map<String, String> body) {
        String author   = body.getOrDefault("author",   "Dispatcher");
        String noteText = body.getOrDefault("noteText",  "");
        String noteType = body.getOrDefault("noteType",  "TEXT");
        return service.addNote(incidentId, author, noteText, noteType);
    }

    @PostMapping("/resources/{drId}/route")
    public ResponseEntity<Void> saveRoute(
            @PathVariable long drId,
            @RequestBody Map<String, Object> body) {
        String geojson = body.getOrDefault("routeGeojson", "").toString();
        int distM = body.containsKey("distanceM") ? ((Number) body.get("distanceM")).intValue() : 0;
        int durS  = body.containsKey("durationS") ? ((Number) body.get("durationS")).intValue() : 0;
        service.saveRoute(drId, geojson, distM, durS);
        return ResponseEntity.noContent().build();
    }

    /** Incident Watch: recent activity feed across all incidents (last 60 events). */
    @GetMapping("/watch")
    public List<Map<String, Object>> watch(
            @RequestParam(defaultValue = "60") int limit) {
        return service.activityFeed(Math.min(limit, 100));
    }
}
