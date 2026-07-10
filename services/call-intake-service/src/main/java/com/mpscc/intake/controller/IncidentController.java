package com.mpscc.intake.controller;

import com.mpscc.intake.domain.Incident;
import com.mpscc.intake.model.CreateIncidentRequest;
import com.mpscc.intake.service.IncidentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/incidents")
public class IncidentController {

    private final IncidentService service;

    public IncidentController(IncidentService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestBody CreateIncidentRequest req) {
        Incident inc = service.create(req);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", inc.getId());
        m.put("reference", inc.getReference());
        m.put("priority", inc.getPriority());
        m.put("status", inc.getStatus());
        m.put("createdAt", inc.getCreatedAt());
        return ResponseEntity.status(201).body(m);
    }

    @GetMapping("/recent")
    public List<Map<String, Object>> recent() {
        return service.recent().stream().map(inc -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", inc.getId());
            m.put("reference", inc.getReference());
            m.put("priority", inc.getPriority());
            m.put("status", inc.getStatus());
            m.put("crimeType", inc.getCrimeType());
            m.put("createdAt", inc.getCreatedAt());
            m.put("latitude", inc.getLatitude());
            m.put("longitude", inc.getLongitude());
            return m;
        }).toList();
    }

    @GetMapping("/count")
    public Map<String, Long> count() {
        return Map.of("total", service.count());
    }
}
