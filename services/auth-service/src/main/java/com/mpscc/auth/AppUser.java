package com.mpscc.auth;

import jakarta.persistence.*;

@Entity
@Table(name = "app_users")
public class AppUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    private String displayName;

    @Column(nullable = false)
    private String passwordHash;

    /** Comma-separated role codes, e.g. "RESPONDER,DISPATCHER". */
    private String roles;

    /** Comma-separated group codes. */
    private String groups;

    private Long stationId;

    private boolean enabled = true;

    public AppUser() {}

    public AppUser(String username, String displayName, String passwordHash, String roles, String groups, Long stationId) {
        this.username = username;
        this.displayName = displayName;
        this.passwordHash = passwordHash;
        this.roles = roles;
        this.groups = groups;
        this.stationId = stationId;
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getDisplayName() { return displayName; }
    public String getPasswordHash() { return passwordHash; }
    public String getRoles() { return roles; }
    public String getGroups() { return groups; }
    public Long getStationId() { return stationId; }
    public boolean isEnabled() { return enabled; }
}
