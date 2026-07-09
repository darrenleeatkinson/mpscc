package com.mpscc.resource.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "officers")
public class Officer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "collar_number", unique = true, nullable = false)
    private String collarNumber;

    @Column(nullable = false)
    private String forename;

    @Column(nullable = false)
    private String surname;

    @Column(nullable = false)
    private String rank;

    @Column(name = "home_station")
    private Long homeStationId;

    @Column(name = "default_mode", nullable = false)
    private String defaultMode;

    @Column(name = "is_firearms", nullable = false)
    private boolean firearms;

    @Column(nullable = false)
    private String status;

    public Long getId() { return id; }
    public String getCollarNumber() { return collarNumber; }
    public String getForename() { return forename; }
    public String getSurname() { return surname; }
    public String getRank() { return rank; }
    public Long getHomeStationId() { return homeStationId; }
    public String getDefaultMode() { return defaultMode; }
    public boolean isFirearms() { return firearms; }
    public String getStatus() { return status; }
}
