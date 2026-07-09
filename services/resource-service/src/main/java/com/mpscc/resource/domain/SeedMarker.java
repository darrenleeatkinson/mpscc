package com.mpscc.resource.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "seed_marker")
public class SeedMarker {

    @Id
    private String name;

    @Column(name = "seeded_at", nullable = false)
    private Instant seededAt;

    @Column(name = "row_count")
    private Long rowCount;

    public SeedMarker() {}

    public SeedMarker(String name, long rowCount) {
        this.name = name;
        this.seededAt = Instant.now();
        this.rowCount = rowCount;
    }

    public String getName() { return name; }
    public Instant getSeededAt() { return seededAt; }
    public Long getRowCount() { return rowCount; }
}
