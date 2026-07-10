package com.mpscc.intake.service;

import com.mpscc.intake.model.CrimeAssessment;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Random;

@Service
public class CrimeAssessorService {

    private static final Random RNG = new Random();

    private static final String[] TYPES = {
        "THEFT", "DISORDER", "ASSAULT", "CRIMINAL_DAMAGE", "SUSPICIOUS_ACTIVITY",
        "VEHICLE_THEFT", "DOMESTIC_VIOLENCE", "BURGLARY", "DRUG_OFFENCE",
        "ROAD_TRAFFIC_INCIDENT", "ROBBERY", "MISSING_PERSON", "KNIFE_CRIME",
        "FRAUD", "FIREARMS_INCIDENT"
    };
    private static final int[] WEIGHTS = { 20, 15, 12, 10, 8, 8, 7, 6, 5, 4, 3, 3, 2, 1, 1 };
    private static final int TOTAL_WEIGHT = 105;

    public CrimeAssessment assess(String callId) {
        String type = pickWeighted();
        boolean injuries = pickInjuries(type);
        boolean weapons = pickWeapons(type);
        boolean suspects = RNG.nextFloat() < 0.4f;
        int atRisk = injuries ? RNG.nextInt(3) + 1 : 0;
        int priority = calcPriority(type, injuries, weapons, suspects);
        String description = buildDescription(type, injuries, weapons, suspects);

        CrimeAssessment a = new CrimeAssessment();
        a.setCallId(callId);
        a.setCrimeType(type);
        a.setDescription(description);
        a.setInjuries(injuries);
        a.setWeapons(weapons);
        a.setSuspectsOnScene(suspects);
        a.setPeopleAtRisk(atRisk);
        a.setSuggestedPriority(priority);
        return a;
    }

    private String pickWeighted() {
        int r = RNG.nextInt(TOTAL_WEIGHT);
        int cum = 0;
        for (int i = 0; i < TYPES.length; i++) {
            cum += WEIGHTS[i];
            if (r < cum) return TYPES[i];
        }
        return TYPES[0];
    }

    private boolean pickInjuries(String type) {
        return switch (type) {
            case "ASSAULT", "DOMESTIC_VIOLENCE", "KNIFE_CRIME" -> RNG.nextFloat() < 0.6f;
            case "ROBBERY", "FIREARMS_INCIDENT", "ROAD_TRAFFIC_INCIDENT" -> RNG.nextFloat() < 0.45f;
            default -> RNG.nextFloat() < 0.05f;
        };
    }

    private boolean pickWeapons(String type) {
        return switch (type) {
            case "KNIFE_CRIME", "FIREARMS_INCIDENT" -> true;
            case "ROBBERY", "ASSAULT" -> RNG.nextFloat() < 0.3f;
            default -> RNG.nextFloat() < 0.04f;
        };
    }

    private int calcPriority(String type, boolean injuries, boolean weapons, boolean suspects) {
        if ("FIREARMS_INCIDENT".equals(type)) return 1;
        if (weapons && injuries) return 1;
        if ("KNIFE_CRIME".equals(type) && (injuries || suspects)) return 1;
        if ("DOMESTIC_VIOLENCE".equals(type) && injuries) return 1;
        if (injuries && suspects) return 2;
        if (List.of("ROBBERY", "BURGLARY", "DOMESTIC_VIOLENCE").contains(type) && suspects) return 2;
        if (List.of("ASSAULT", "ROBBERY", "VEHICLE_THEFT", "BURGLARY", "CRIMINAL_DAMAGE").contains(type)) return 3;
        return 4;
    }

    private String buildDescription(String type, boolean injuries, boolean weapons, boolean suspects) {
        StringBuilder sb = new StringBuilder(switch (type) {
            case "THEFT" -> "Caller reports theft in progress or recently occurred.";
            case "ASSAULT" -> "Caller reports a physical assault.";
            case "BURGLARY" -> "Caller reports a burglary at residential or commercial premises.";
            case "ROBBERY" -> "Caller reports a robbery — victim approached and threatened.";
            case "KNIFE_CRIME" -> "Caller reports a knife crime in progress.";
            case "FIREARMS_INCIDENT" -> "FIREARMS INCIDENT — caller reports shots fired or firearm sighted.";
            case "DISORDER" -> "Caller reports public disorder or disturbance.";
            case "CRIMINAL_DAMAGE" -> "Caller reports criminal damage to property.";
            case "VEHICLE_THEFT" -> "Caller reports vehicle theft or taking without consent.";
            case "DOMESTIC_VIOLENCE" -> "Caller reports a domestic violence incident.";
            case "DRUG_OFFENCE" -> "Caller reports drug-related activity.";
            case "SUSPICIOUS_ACTIVITY" -> "Caller reports suspicious persons or activity.";
            case "ROAD_TRAFFIC_INCIDENT" -> "Caller reports a road traffic incident.";
            case "MISSING_PERSON" -> "Caller reports a missing person.";
            case "FRAUD" -> "Caller reports fraud or financial crime in progress.";
            default -> "Caller reporting an incident.";
        });
        if (injuries) sb.append(" Injuries reported.");
        if (weapons) sb.append(" Weapon involved.");
        if (suspects) sb.append(" Suspect(s) still on scene.");
        return sb.toString();
    }
}
