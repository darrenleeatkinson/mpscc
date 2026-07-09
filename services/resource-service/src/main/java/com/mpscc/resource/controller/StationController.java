package com.mpscc.resource.controller;

import com.mpscc.resource.repository.StationRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/stations")
public class StationController {

    private final StationRepository stations;

    public StationController(StationRepository stations) {
        this.stations = stations;
    }

    @GetMapping
    public List<Map<String, Object>> list() {
        return toMaps(stations.findAllWithCoordinates());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable Long id) {
        List<Object[]> rows = stations.findByIdWithCoordinates(id);
        if (rows.isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(toMap(rows.get(0)));
    }

    @GetMapping("/count")
    public Map<String, Long> count() {
        return Map.of("total", stations.count());
    }

    private List<Map<String, Object>> toMaps(List<Object[]> rows) {
        List<Map<String, Object>> result = new ArrayList<>(rows.size());
        for (Object[] r : rows) result.add(toMap(r));
        return result;
    }

    private Map<String, Object> toMap(Object[] r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",       r[0]);
        m.put("name",     r[1]);
        m.put("type",     r[2]);
        m.put("borough",  r[3]);
        m.put("capacity", r[4]);
        m.put("sizeBand", r[5]);
        m.put("latitude", r[6]);
        m.put("longitude",r[7]);
        return m;
    }
}
