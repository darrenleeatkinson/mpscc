package com.mpscc.resource.repository;

import com.mpscc.resource.domain.Officer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface OfficerRepository extends JpaRepository<Officer, Long> {

    @Query("""
            SELECT o FROM Officer o
            WHERE (:ranksEmpty = true OR o.rank IN :ranks)
              AND (:stationId IS NULL OR o.homeStationId = :stationId)
              AND (:firearms IS NULL OR o.firearms = :firearms)
            """)
    Page<Officer> findFiltered(
            @Param("ranksEmpty") boolean ranksEmpty,
            @Param("ranks") List<String> ranks,
            @Param("stationId") Long stationId,
            @Param("firearms") Boolean firearms,
            Pageable pageable);

    long countByFirearms(boolean firearms);
    long countByRank(String rank);
}
