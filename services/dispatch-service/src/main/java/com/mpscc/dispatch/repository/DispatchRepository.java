package com.mpscc.dispatch.repository;

import com.mpscc.dispatch.domain.Dispatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface DispatchRepository extends JpaRepository<Dispatch, Long> {

    @Query("SELECT d FROM Dispatch d WHERE d.status IN ('ACTIVE','ON_SCENE') ORDER BY d.priority ASC, d.createdAt ASC")
    List<Dispatch> findActive();
}
