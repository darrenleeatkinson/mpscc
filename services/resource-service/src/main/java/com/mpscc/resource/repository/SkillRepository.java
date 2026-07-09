package com.mpscc.resource.repository;

import com.mpscc.resource.domain.Skill;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SkillRepository extends JpaRepository<Skill, Integer> {
    Optional<Skill> findByCode(String code);
}
