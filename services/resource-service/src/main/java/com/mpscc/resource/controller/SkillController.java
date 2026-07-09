package com.mpscc.resource.controller;

import com.mpscc.resource.domain.Skill;
import com.mpscc.resource.repository.SkillRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class SkillController {

    private final SkillRepository skills;

    public SkillController(SkillRepository skills) {
        this.skills = skills;
    }

    @GetMapping("/skills")
    public List<Skill> listSkills() {
        return skills.findAll();
    }
}
