package com.mpscc.dispatch.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "dispatches")
public class Dispatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long incidentId;

    @Column(nullable = false)
    private String incidentRef;

    @Column(nullable = false)
    private int priority;

    @Column(nullable = false)
    private String status;

    @Column(nullable = false)
    private OffsetDateTime createdAt;

    private OffsetDateTime onSceneAt;
    private OffsetDateTime resolvedAt;

    public Long getId()                     { return id; }
    public Long getIncidentId()             { return incidentId; }
    public void setIncidentId(Long v)       { this.incidentId = v; }
    public String getIncidentRef()          { return incidentRef; }
    public void setIncidentRef(String v)    { this.incidentRef = v; }
    public int getPriority()                { return priority; }
    public void setPriority(int v)          { this.priority = v; }
    public String getStatus()               { return status; }
    public void setStatus(String v)         { this.status = v; }
    public OffsetDateTime getCreatedAt()    { return createdAt; }
    public void setCreatedAt(OffsetDateTime v) { this.createdAt = v; }
    public OffsetDateTime getOnSceneAt()    { return onSceneAt; }
    public void setOnSceneAt(OffsetDateTime v) { this.onSceneAt = v; }
    public OffsetDateTime getResolvedAt()   { return resolvedAt; }
    public void setResolvedAt(OffsetDateTime v) { this.resolvedAt = v; }
}
