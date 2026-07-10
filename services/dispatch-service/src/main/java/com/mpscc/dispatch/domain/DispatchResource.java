package com.mpscc.dispatch.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "dispatch_resources")
public class DispatchResource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long dispatchId;

    @Column(nullable = false)
    private String resourceType;  // OFFICER | VEHICLE

    @Column(nullable = false)
    private Long resourceId;

    @Column(nullable = false)
    private String resourceRef;   // collar_number or vehicle identifier

    private String resourceName;  // officer full name or vehicle type

    @Column(nullable = false)
    private OffsetDateTime assignedAt;

    public Long getId()                      { return id; }
    public Long getDispatchId()              { return dispatchId; }
    public void setDispatchId(Long v)        { this.dispatchId = v; }
    public String getResourceType()          { return resourceType; }
    public void setResourceType(String v)    { this.resourceType = v; }
    public Long getResourceId()              { return resourceId; }
    public void setResourceId(Long v)        { this.resourceId = v; }
    public String getResourceRef()           { return resourceRef; }
    public void setResourceRef(String v)     { this.resourceRef = v; }
    public String getResourceName()          { return resourceName; }
    public void setResourceName(String v)    { this.resourceName = v; }
    public OffsetDateTime getAssignedAt()    { return assignedAt; }
    public void setAssignedAt(OffsetDateTime v) { this.assignedAt = v; }
}
