package com.mpscc.dispatch.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "dispatch_resources")
public class DispatchResource {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false) private Long   dispatchId;
    @Column(nullable = false) private String resourceType;  // OFFICER | VEHICLE
    @Column(nullable = false) private Long   resourceId;
    @Column(nullable = false) private String resourceRef;   // collar_number or vehicle identifier
    private String resourceName;
    @Column(nullable = false) private OffsetDateTime assignedAt;

    // Live position tracking
    private Double currentLat;
    private Double currentLon;
    private Double targetLat;
    private Double targetLon;
    private String mode;  // CAR | VAN | MOTORBIKE | SCOOTER | PUSHBIKE | FOOT | DOG_CAR

    public Long   getId()                        { return id; }
    public Long   getDispatchId()                { return dispatchId; }
    public void   setDispatchId(Long v)          { this.dispatchId = v; }
    public String getResourceType()              { return resourceType; }
    public void   setResourceType(String v)      { this.resourceType = v; }
    public Long   getResourceId()                { return resourceId; }
    public void   setResourceId(Long v)          { this.resourceId = v; }
    public String getResourceRef()               { return resourceRef; }
    public void   setResourceRef(String v)       { this.resourceRef = v; }
    public String getResourceName()              { return resourceName; }
    public void   setResourceName(String v)      { this.resourceName = v; }
    public OffsetDateTime getAssignedAt()        { return assignedAt; }
    public void   setAssignedAt(OffsetDateTime v){ this.assignedAt = v; }
    public Double getCurrentLat()               { return currentLat; }
    public void   setCurrentLat(Double v)       { this.currentLat = v; }
    public Double getCurrentLon()               { return currentLon; }
    public void   setCurrentLon(Double v)       { this.currentLon = v; }
    public Double getTargetLat()                { return targetLat; }
    public void   setTargetLat(Double v)        { this.targetLat = v; }
    public Double getTargetLon()                { return targetLon; }
    public void   setTargetLon(Double v)        { this.targetLon = v; }
    public String getMode()                     { return mode; }
    public void   setMode(String v)             { this.mode = v; }
}
