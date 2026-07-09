package com.mpscc.resource.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "stations")
public class Station {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String type;

    private String borough;

    @Column(nullable = false)
    private Integer capacity;

    @Column(name = "size_band")
    private String sizeBand;

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getType() { return type; }
    public String getBorough() { return borough; }
    public Integer getCapacity() { return capacity; }
    public String getSizeBand() { return sizeBand; }
}
