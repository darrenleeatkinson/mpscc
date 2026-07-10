package com.mpscc.intake.model;

public class CallInbound {
    private String callId;
    private String phone;
    private String postcode;
    private String address;
    private double latitude;
    private double longitude;
    private int accuracyMeters;
    private long tsn;

    public String getCallId() { return callId; }
    public void setCallId(String callId) { this.callId = callId; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getPostcode() { return postcode; }
    public void setPostcode(String postcode) { this.postcode = postcode; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }
    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }
    public int getAccuracyMeters() { return accuracyMeters; }
    public void setAccuracyMeters(int accuracyMeters) { this.accuracyMeters = accuracyMeters; }
    public long getTsn() { return tsn; }
    public void setTsn(long tsn) { this.tsn = tsn; }
}
