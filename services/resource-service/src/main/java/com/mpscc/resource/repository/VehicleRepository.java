package com.mpscc.resource.repository;

import com.mpscc.resource.domain.Vehicle;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VehicleRepository extends JpaRepository<Vehicle, Long> {

    @Query("""
            SELECT v FROM Vehicle v
            WHERE (:type IS NULL OR v.type = :type)
              AND (:stationId IS NULL OR v.homeStationId = :stationId)
              AND (:status IS NULL OR v.status = :status)
            """)
    Page<Vehicle> findFiltered(
            @Param("type") String type,
            @Param("stationId") Long stationId,
            @Param("status") String status,
            Pageable pageable);

    long countByType(String type);
}
