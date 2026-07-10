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

    private static final String[] POSTCODES = {
        "E1", "E2", "E3", "E5", "E8", "E9", "EC1", "EC2", "EC3",
        "N1", "N4", "N7", "N16", "NW1", "NW3", "NW5", "NW6",
        "SE1", "SE5", "SE10", "SE15", "SE17",
        "SW1", "SW3", "SW6", "SW9", "SW11",
        "W1", "W2", "W6", "WC1", "WC2"
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

    // Tick every 5 seconds; decide probabilistically whether to emit a call
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
        String area = POSTCODES[RNG.nextInt(POSTCODES.length)];
        String sector = (RNG.nextInt(9) + 1)
            + String.valueOf((char) ('A' + RNG.nextInt(26)))
            + String.valueOf((char) ('A' + RNG.nextInt(26)));

        CallInbound call = new CallInbound();
        call.setCallId(UUID.randomUUID().toString());
        call.setPhone("+44 7700 9" + String.format("%05d", RNG.nextInt(100000)));
        call.setPostcode(area + " " + sector);
        call.setAddress((RNG.nextInt(200) + 1) + " " + STREETS[RNG.nextInt(STREETS.length)]);
        // London bounding box: lat 51.28–51.69, lon -0.51–0.33
        call.setLatitude(51.28 + RNG.nextDouble() * 0.41);
        call.setLongitude(-0.51 + RNG.nextDouble() * 0.84);
        call.setAccuracyMeters(RNG.nextInt(200) + 50);
        call.setTsn(System.currentTimeMillis());
        return call;
    }
}
