package com.mpscc.resource.repository;

import com.mpscc.resource.domain.Station;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface StationRepository extends JpaRepository<Station, Long> {

    @Query(value = """
            SELECT id, name, type, borough, capacity, size_band,
                   ST_Y(location::geometry) AS latitude,
                   ST_X(location::geometry) AS longitude
            FROM stations
            ORDER BY borough, name
            """, nativeQuery = true)
    List<Object[]> findAllWithCoordinates();

    @Query(value = """
            SELECT id, name, type, borough, capacity, size_band,
                   ST_Y(location::geometry) AS latitude,
                   ST_X(location::geometry) AS longitude
            FROM stations WHERE id = :id
            """, nativeQuery = true)
    List<Object[]> findByIdWithCoordinates(Long id);
}
