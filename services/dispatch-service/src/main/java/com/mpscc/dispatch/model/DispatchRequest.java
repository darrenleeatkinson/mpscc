package com.mpscc.dispatch.model;

import java.util.List;

public class DispatchRequest {
    private long incidentId;
    private List<Long> officerIds;
    private List<Long> vehicleIds;

    public long getIncidentId()              { return incidentId; }
    public void setIncidentId(long v)        { this.incidentId = v; }
    public List<Long> getOfficerIds()        { return officerIds != null ? officerIds : List.of(); }
    public void setOfficerIds(List<Long> v)  { this.officerIds = v; }
    public List<Long> getVehicleIds()        { return vehicleIds != null ? vehicleIds : List.of(); }
    public void setVehicleIds(List<Long> v)  { this.vehicleIds = v; }
}
