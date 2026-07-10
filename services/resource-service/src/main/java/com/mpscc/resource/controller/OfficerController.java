package com.mpscc.resource.controller;

import com.mpscc.resource.domain.Officer;
import com.mpscc.resource.domain.Skill;
import com.mpscc.resource.repository.OfficerRepository;
import com.mpscc.resource.repository.SkillRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/officers")
public class OfficerController {

    private final OfficerRepository officers;
    private final SkillRepository skills;
    private final JdbcTemplate jdbc;

    public OfficerController(OfficerRepository officers, SkillRepository skills, JdbcTemplate jdbc) {
        this.officers = officers;
        this.skills = skills;
        this.jdbc = jdbc;
    }

    @GetMapping
    public Page<Officer> list(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) List<String> rank,
            @RequestParam(required = false) Long station,
            @RequestParam(required = false) Boolean firearms) {
        boolean ranksEmpty = (rank == null || rank.isEmpty());
        return officers.findFiltered(ranksEmpty, ranksEmpty ? List.of() : rank, station, firearms,
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

    @PatchMapping("/{id}")
    public ResponseEntity<Map<String, Object>> update(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        return officers.findById(id).map(o -> {
            if (body.containsKey("rank"))        o.setRank((String) body.get("rank"));
            if (body.containsKey("status"))      o.setStatus((String) body.get("status"));
            if (body.containsKey("defaultMode")) o.setDefaultMode((String) body.get("defaultMode"));
            if (body.containsKey("firearms"))    o.setFirearms(Boolean.TRUE.equals(body.get("firearms")));
            if (body.containsKey("homeStationId")) {
                Object v = body.get("homeStationId");
                o.setHomeStationId(v == null ? null : ((Number) v).longValue());
            }
            officers.save(o);
            return ResponseEntity.ok(toDetail(o));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/skills/{code}")
    public ResponseEntity<Map<String, Object>> addSkill(
            @PathVariable Long id,
            @PathVariable String code) {
        Officer officer = officers.findById(id).orElse(null);
        if (officer == null) return ResponseEntity.notFound().build();
        Skill skill = skills.findByCode(code).orElse(null);
        if (skill == null) return ResponseEntity.badRequest().build();

        jdbc.update("""
                INSERT INTO officer_skills (officer_id, skill_id, certified_on)
                VALUES (?, ?, ?)
                ON CONFLICT (officer_id, skill_id) DO NOTHING
                """, id, skill.getId(), LocalDate.now());

        if (code.equals("FIREARMS")) {
            officer.setFirearms(true);
            officers.save(officer);
        }
        return ResponseEntity.ok(toDetail(officer));
    }

    @DeleteMapping("/{id}/skills/{code}")
    public ResponseEntity<Map<String, Object>> removeSkill(
            @PathVariable Long id,
            @PathVariable String code) {
        Officer officer = officers.findById(id).orElse(null);
        if (officer == null) return ResponseEntity.notFound().build();
        Skill skill = skills.findByCode(code).orElse(null);
        if (skill == null) return ResponseEntity.badRequest().build();

        jdbc.update("DELETE FROM officer_skills WHERE officer_id = ? AND skill_id = ?",
                id, skill.getId());

        if (code.equals("FIREARMS")) {
            officer.setFirearms(false);
            officers.save(officer);
        }
        return ResponseEntity.ok(toDetail(officer));
    }

    private Map<String, Object> toDetail(Officer o) {
        List<Map<String, Object>> skillList = jdbc.queryForList("""
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
                "homeStationId", o.getHomeStationId() != null ? o.getHomeStationId() : 0,
                "defaultMode",   o.getDefaultMode(),
                "firearms",      o.isFirearms(),
                "status",        o.getStatus(),
                "skills",        skillList
        );
    }
}
