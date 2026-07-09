package com.mpscc.resource.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "vehicles")
public class Vehicle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String type;

    @Column(unique = true, nullable = false)
    private String identifier;

    @Column(nullable = false)
    private Integer seats;

    @Column(name = "home_station")
    private Long homeStationId;

    @Column(nullable = false)
    private String status;

    public Long getId() { return id; }
    public String getType() { return type; }
    public String getIdentifier() { return identifier; }
    public Integer getSeats() { return seats; }
    public Long getHomeStationId() { return homeStationId; }
    public String getStatus() { return status; }
}
