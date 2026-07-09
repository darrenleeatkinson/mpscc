package com.mpscc.resource.repository;

import com.mpscc.resource.domain.Postcode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface PostcodeRepository extends JpaRepository<Postcode, String> {

    @Query(value = """
            SELECT postcode, district, borough,
                   ST_Y(centroid::geometry) AS latitude,
                   ST_X(centroid::geometry) AS longitude
            FROM postcodes
            WHERE inside_m25 = TRUE
            ORDER BY postcode
            """, nativeQuery = true)
    List<Object[]> findAllWithCoordinates();
}
