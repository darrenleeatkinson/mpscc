package com.mpscc.intake.repository;

import com.mpscc.intake.domain.Incident;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface IncidentRepository extends JpaRepository<Incident, Long> {
    List<Incident> findTop10ByOrderByCreatedAtDesc();
}
