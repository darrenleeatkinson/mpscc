package com.mpscc.simulator.service;

import com.mpscc.simulator.model.CallInbound;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Random;
import java.util.UUID;

@Service
public class CallSimulatorService {

    private static final Random RNG = new Random();
    private static final ZoneId LONDON = ZoneId.of("Europe/London");

    // Demand curve: index = hour of day (0–23), value = relative call rate
    private static final double[] DEMAND = {
        0.30, 0.20, 0.15, 0.10, 0.10, 0.15,  // 00–05
        0.20, 0.35, 0.50, 0.60, 0.70, 0.75,  // 06–11
        0.80, 0.80, 0.85, 0.90, 1.00, 1.00,  // 12–17
        1.00, 0.95, 0.90, 0.80, 0.65, 0.45   // 18–23
    };

    // Each area owns its geographic centre and a jitter radius so that the
    // generated lat/lon always lands inside the real postcode district.
    private record PostcodeArea(String district, double lat, double lon, double radius) {}

    private static final PostcodeArea[] AREAS = {
        new PostcodeArea("E1",   51.515, -0.071, 0.014),
        new PostcodeArea("E2",   51.526, -0.067, 0.012),
        new PostcodeArea("E3",   51.530, -0.024, 0.018),
        new PostcodeArea("E5",   51.558, -0.047, 0.018),
        new PostcodeArea("E8",   51.543, -0.062, 0.015),
        new PostcodeArea("E9",   51.548, -0.049, 0.018),
        new PostcodeArea("EC1",  51.522, -0.103, 0.014),
        new PostcodeArea("EC2",  51.518, -0.092, 0.011),
        new PostcodeArea("EC3",  51.512, -0.083, 0.011),
        new PostcodeArea("N1",   51.538, -0.101, 0.020),
        new PostcodeArea("N4",   51.563, -0.104, 0.018),
        new PostcodeArea("N7",   51.554, -0.116, 0.015),
        new PostcodeArea("N16",  51.562, -0.079, 0.018),
        new PostcodeArea("NW1",  51.535, -0.148, 0.020),
        new PostcodeArea("NW3",  51.553, -0.169, 0.018),
        new PostcodeArea("NW5",  51.556, -0.142, 0.015),
        new PostcodeArea("NW6",  51.544, -0.185, 0.015),
        new PostcodeArea("SE1",  51.502, -0.099, 0.018),
        new PostcodeArea("SE5",  51.472, -0.082, 0.018),
        new PostcodeArea("SE10", 51.482,  0.006, 0.018),
        new PostcodeArea("SE15", 51.468, -0.065, 0.020),
        new PostcodeArea("SE17", 51.489, -0.092, 0.014),
        new PostcodeArea("SW1",  51.499, -0.143, 0.018),
        new PostcodeArea("SW3",  51.488, -0.170, 0.015),
        new PostcodeArea("SW6",  51.473, -0.195, 0.020),
        new PostcodeArea("SW9",  51.466, -0.115, 0.015),
        new PostcodeArea("SW11", 51.468, -0.165, 0.020),
        new PostcodeArea("W1",   51.513, -0.143, 0.018),
        new PostcodeArea("W2",   51.515, -0.180, 0.018),
        new PostcodeArea("W6",   51.490, -0.222, 0.018),
        new PostcodeArea("WC1",  51.522, -0.122, 0.014),
        new PostcodeArea("WC2",  51.512, -0.122, 0.014),
    };

    private static final String[] STREETS = {
        "High Street", "Church Road", "Station Road", "Park Lane", "Victoria Road",
        "London Road", "King Street", "Manor Road", "Green Lane", "Mill Road",
        "Albert Road", "Queen Street", "Bridge Road", "York Road", "Chestnut Avenue",
        "Elm Avenue", "Oak Road", "Rose Street", "Trafalgar Way", "Westminster Close",
        "Borough Road", "Commercial Street", "Whitechapel Road", "Lewisham Way", "Brixton Road"
    };

    private final RestTemplate rest;

    @Value("${sim.intensity:1.0}")
    private double intensity;

    @Value("${sim.intake-url:http://call-intake-service:8082}")
    private String intakeUrl;

    public CallSimulatorService(RestTemplate rest) {
        this.rest = rest;
    }

    @Scheduled(fixedRate = 5000)
    public void tick() {
        int hour = LocalTime.now(LONDON).getHour();
        double probability = intensity * DEMAND[hour] * 0.35;
        if (RNG.nextDouble() < probability) {
            sendCall(generateCall());
        }
    }

    private void sendCall(CallInbound call) {
        try {
            rest.postForEntity(intakeUrl + "/internal/calls", call, Void.class);
        } catch (Exception ignored) {
            // intake-service not ready yet or temporary failure — try next tick
        }
    }

    private CallInbound generateCall() {
        // Pick a geographic area; derive lat/lon and postcode from the same source
        PostcodeArea area = AREAS[RNG.nextInt(AREAS.length)];
        double lat = area.lat() + (RNG.nextDouble() * 2 - 1) * area.radius();
        double lon = area.lon() + (RNG.nextDouble() * 2 - 1) * area.radius();

        // Postcode sector suffix — still synthetic but the district is accurate
        String sector = (RNG.nextInt(9) + 1)
            + String.valueOf((char) ('A' + RNG.nextInt(26)))
            + String.valueOf((char) ('A' + RNG.nextInt(26)));

        CallInbound call = new CallInbound();
        call.setCallId(UUID.randomUUID().toString());
        call.setPhone("+44 7700 9" + String.format("%05d", RNG.nextInt(100000)));
        call.setPostcode(area.district() + " " + sector);
        call.setAddress((RNG.nextInt(200) + 1) + " " + STREETS[RNG.nextInt(STREETS.length)]);
        call.setLatitude(lat);
        call.setLongitude(lon);
        call.setAccuracyMeters(RNG.nextInt(200) + 50);
        call.setTsn(System.currentTimeMillis());
        return call;
    }
}
