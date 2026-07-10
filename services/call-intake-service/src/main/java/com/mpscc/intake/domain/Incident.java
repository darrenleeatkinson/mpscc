package com.mpscc.intake.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "incidents")
public class Incident {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 14)
    private String reference;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(nullable = false)
    private int priority;

    private String callId;
    private String callerPhone;
    private String callerName;
    private String address;

    @Column(length = 10)
    private String postcode;

    private Double latitude;
    private Double longitude;

    @Column(length = 50)
    private String crimeType;

    @Column(columnDefinition = "TEXT")
    private String crimeDescription;

    @Column(nullable = false)
    private boolean injuries;

    @Column(nullable = false)
    private boolean weapons;

    @Column(nullable = false)
    private boolean suspectsOnScene;

    @Column(nullable = false)
    private int peopleAtRisk;

    @Column(nullable = false)
    private OffsetDateTime createdAt;

    public Long getId() { return id; }
    public String getReference() { return reference; }
    public void setReference(String reference) { this.reference = reference; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }
    public String getCallId() { return callId; }
    public void setCallId(String callId) { this.callId = callId; }
    public String getCallerPhone() { return callerPhone; }
    public void setCallerPhone(String callerPhone) { this.callerPhone = callerPhone; }
    public String getCallerName() { return callerName; }
    public void setCallerName(String callerName) { this.callerName = callerName; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getPostcode() { return postcode; }
    public void setPostcode(String postcode) { this.postcode = postcode; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public String getCrimeType() { return crimeType; }
    public void setCrimeType(String crimeType) { this.crimeType = crimeType; }
    public String getCrimeDescription() { return crimeDescription; }
    public void setCrimeDescription(String crimeDescription) { this.crimeDescription = crimeDescription; }
    public boolean isInjuries() { return injuries; }
    public void setInjuries(boolean injuries) { this.injuries = injuries; }
    public boolean isWeapons() { return weapons; }
    public void setWeapons(boolean weapons) { this.weapons = weapons; }
    public boolean isSuspectsOnScene() { return suspectsOnScene; }
    public void setSuspectsOnScene(boolean suspectsOnScene) { this.suspectsOnScene = suspectsOnScene; }
    public int getPeopleAtRisk() { return peopleAtRisk; }
    public void setPeopleAtRisk(int peopleAtRisk) { this.peopleAtRisk = peopleAtRisk; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
