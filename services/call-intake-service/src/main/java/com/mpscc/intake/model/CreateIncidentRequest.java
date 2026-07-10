package com.mpscc.intake.model;

public class CreateIncidentRequest {
    private String callId;
    private String callerPhone;
    private String callerName;
    private String address;
    private String postcode;
    private Double latitude;
    private Double longitude;
    private String crimeType;
    private String crimeDescription;
    private boolean injuries;
    private boolean weapons;
    private boolean suspectsOnScene;
    private int peopleAtRisk;
    private int priority;

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
    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }
}
