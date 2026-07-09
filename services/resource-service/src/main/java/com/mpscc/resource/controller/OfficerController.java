package com.mpscc.resource.controller;

import com.mpscc.resource.domain.Officer;
import com.mpscc.resource.repository.OfficerRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/officers")
public class OfficerController {

    private final OfficerRepository officers;
    private final JdbcTemplate jdbc;

    public OfficerController(OfficerRepository officers, JdbcTemplate jdbc) {
        this.officers = officers;
        this.jdbc = jdbc;
    }

    @GetMapping
    public Page<Officer> list(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String rank,
            @RequestParam(required = false) Long station,
            @RequestParam(required = false) Boolean firearms) {
        return officers.findFiltered(rank, station, firearms,
                PageRequest.of(page, size, Sort.by("surname", "forename")));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable Long id) {
        return officers.findById(id)
                .map(o -> ResponseEntity.ok(toDetail(o)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/count")
    public Map<String, Object> count() {
        return Map.of(
                "total",    officers.count(),
                "firearms", officers.countByFirearms(true),
                "pc",       officers.countByRank("PC"),
                "dc",       officers.countByRank("DC")
        );
    }

    private Map<String, Object> toDetail(Officer o) {
        List<Map<String, Object>> skills = jdbc.queryForList("""
                SELECT s.code, s.name, s.category
                FROM officer_skills os JOIN skills s ON s.id = os.skill_id
                WHERE os.officer_id = ?
                """, o.getId());
        return Map.of(
                "id",            o.getId(),
                "collarNumber",  o.getCollarNumber(),
                "forename",      o.getForename(),
                "surname",       o.getSurname(),
                "rank",          o.getRank(),
                "homeStationId", o.getHomeStationId(),
                "defaultMode",   o.getDefaultMode(),
                "firearms",      o.isFirearms(),
                "status",        o.getStatus(),
                "skills",        skills
        );
    }
}
