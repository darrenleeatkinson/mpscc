package com.mpscc.resource.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "postcodes")
public class Postcode {

    @Id
    private String postcode;

    @Column(nullable = false)
    private String district;

    @Column(nullable = false)
    private String borough;

    @Column(name = "inside_m25", nullable = false)
    private boolean insideM25;

    public String getPostcode() { return postcode; }
    public String getDistrict() { return district; }
    public String getBorough() { return borough; }
    public boolean isInsideM25() { return insideM25; }
}
