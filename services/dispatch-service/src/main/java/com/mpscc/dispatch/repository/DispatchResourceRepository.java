package com.mpscc.dispatch.repository;

import com.mpscc.dispatch.domain.DispatchResource;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DispatchResourceRepository extends JpaRepository<DispatchResource, Long> {
    List<DispatchResource> findByDispatchId(Long dispatchId);
}
