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
    public Map<String, Object> resources(@PathVariable long incidentId) {
        return service.suggestResources(incidentId);
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
}
