package com.mpscc.intake.model;

public class CrimeAssessment {
    private String callId;
    private String crimeType;
    private String description;
    private boolean injuries;
    private boolean weapons;
    private boolean suspectsOnScene;
    private int peopleAtRisk;
    private int suggestedPriority;

    public String getCallId() { return callId; }
    public void setCallId(String callId) { this.callId = callId; }
    public String getCrimeType() { return crimeType; }
    public void setCrimeType(String crimeType) { this.crimeType = crimeType; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public boolean isInjuries() { return injuries; }
    public void setInjuries(boolean injuries) { this.injuries = injuries; }
    public boolean isWeapons() { return weapons; }
    public void setWeapons(boolean weapons) { this.weapons = weapons; }
    public boolean isSuspectsOnScene() { return suspectsOnScene; }
    public void setSuspectsOnScene(boolean suspectsOnScene) { this.suspectsOnScene = suspectsOnScene; }
    public int getPeopleAtRisk() { return peopleAtRisk; }
    public void setPeopleAtRisk(int peopleAtRisk) { this.peopleAtRisk = peopleAtRisk; }
    public int getSuggestedPriority() { return suggestedPriority; }
    public void setSuggestedPriority(int suggestedPriority) { this.suggestedPriority = suggestedPriority; }
}
