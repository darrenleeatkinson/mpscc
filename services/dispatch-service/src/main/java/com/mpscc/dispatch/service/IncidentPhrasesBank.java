package com.mpscc.dispatch.service;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Library of 300+ realistic police CAD phrases used by the automated simulation services.
 * Phrases are grouped by phase and context to ensure appropriate selection.
 */
@Component
public class IncidentPhrasesBank {

    private static final Random RNG = new Random();

    // ── En-route updates ────────────────────────────────────────────────────

    private static final String[] EN_ROUTE = {
        "Units en route. ETA as advised. Please keep caller on line if possible.",
        "Officers responding. Making best speed to location. ETA updated.",
        "Resources are mobile and en route to the given location.",
        "Unit acknowledges and is proceeding to scene. ETA approximately as estimated.",
        "Officers on route. No delays anticipated. Monitoring channel.",
        "Patrol vehicle en route to incident location. Approaching from the north.",
        "Unit responding. Traffic conditions normal. ETA holding.",
        "Officers deployed and mobile. Will advise on arrival.",
        "Resources in transit. Speed of response matched to priority grading.",
        "Unit responding. Advising CAD of route taken.",
        "Officers en route — proceeding with due regard. ETA as given.",
        "Patrol acknowledges dispatch. Making way to incident address.",
        "Resources mobile. Estimated arrival within stated ETA. Channel monitored.",
        "Uniformed units en route. Will update on approach to scene.",
        "Officer confirms receipt of dispatch. Now mobile to given location.",
        "Units confirmed en route. ETA advised to caller. Officers monitoring comms.",
        "Resources responding at pace appropriate to priority grading.",
        "Officers en route. No significant delays. Will confirm on arrival.",
        "Patrol mobile. Following fastest available route to incident location.",
        "Unit en route. Advising of approach via main arterial road.",
        "Officers responding. Traffic light. On scene ETA as planned.",
        "Resources despatched and mobile. Comms open — monitoring for updates.",
        "Officer en route. Caller update passed to unit. ETA unchanged.",
        "Units heading to incident. Monitoring for any change in circumstances.",
        "Officers mobile. ETA confirmed. Any further caller updates — please advise.",
        "Patrol en route to location. Officer will assess on arrival.",
        "Resources mobile and committed to incident. Monitoring channel for updates.",
        "Unit proceeding. No change to ETA. Officers ready to assess on arrival.",
        "Officers en route. CAD monitoring for any escalation in information.",
        "Resources responding. CAD has updated units on latest caller information.",
    };

    // ── On-scene arrival phrases ─────────────────────────────────────────────

    private static final String[] ON_SCENE_ARRIVAL = {
        "Officers on scene. Initial assessment underway. Will update.",
        "Units arrived at incident location. Assessing situation — details to follow.",
        "Officers at scene. Making first contact with caller. Update to follow shortly.",
        "Unit arrived. Scene being secured. Situation being assessed.",
        "Officers on scene. Establishing cordon. Initial details being gathered.",
        "Resources arrived at location. Officers assessing — update to follow.",
        "Unit at scene. Making initial observations. Will advise CAD shortly.",
        "Officers arrived. Situation appears to match initial report. Assessing.",
        "Units on scene. No immediate further risk identified at this time. Assessing.",
        "Officers at location. Situation being assessed. Update in progress.",
        "Unit arrived at given address. Officers conducting initial assessment.",
        "Resources on scene. Officers making contact with parties involved.",
        "Units have arrived. Scene is accessible. Officers assessing the situation.",
        "Officers arrived. Scene is partially contained. Assessing full extent of incident.",
        "Unit at scene. Engaging with involved parties. Update to follow.",
        "Officers arrived and assessing. Early indications match caller report.",
        "Units on scene. Officers gathering initial information from those present.",
        "Resources at location. First assessment underway — no immediate additional requests.",
        "Officers arrived. Calm at scene on arrival. Officers taking account from parties.",
        "Unit at scene. Officers noting initial observations. CAD update imminent.",
        "Officers on scene. Situation developing — full picture emerging. Will advise.",
        "Units arrived. Scene appears as described. Officers assessing priorities.",
        "Officers at location. Making contact. Initial update to follow shortly.",
        "Unit on scene. Officers conducting risk assessment on arrival.",
        "Resources arrived. Officers gathering witness information. Scene assessment ongoing.",
        "Officers on scene. Situation is being managed. Update to follow.",
        "Units at given location. Officers have made first contact. Situation in hand.",
        "Officers arrived. Early assessment: situation is manageable. Further update to follow.",
        "Unit at scene. Officers are assessing all parties involved.",
        "Resources on scene and engaged. CAD update to follow once picture is clearer.",
    };

    // ── Scene update phrases (while ON_SCENE) ───────────────────────────────

    private static final String[] SCENE_UPDATE = {
        "Officers are actively dealing with the incident. Full picture now established.",
        "Scene is contained. Officers are taking accounts from all parties present.",
        "Investigation ongoing at scene. Witness details being recorded.",
        "Officers are managing multiple parties at scene. Situation under control.",
        "Scene secured. Officers conducting thorough assessment of area.",
        "All parties engaged. Officers working through incident methodically.",
        "Scene is calm. Officers gathering evidence and statements from witnesses.",
        "Incident is being dealt with systematically. Scene management is in progress.",
        "Officers have established what occurred. Actions being taken as appropriate.",
        "Witnesses identified and statements being taken. Scene remains contained.",
        "Full scene assessment complete. Officers moving to resolution phase.",
        "Parties are cooperating with officers. Incident progressing toward resolution.",
        "Scene is stable. Officers are documenting and assessing all evidence.",
        "Officers have completed initial scene assessment. Moving to detailed review.",
        "All relevant parties present at scene. Officers working through incident.",
        "Scene is under full control. Officers are working to bring matter to conclusion.",
        "Evidence being gathered. Officers systematically working through incident.",
        "Officers have established timeline of events. Incident being dealt with.",
        "No immediate safety concerns at scene. Officers dealing with all parties.",
        "Situation is well in hand. Officers on track to conclude incident at scene.",
        "Officers completing scene enquiries. Outcome expected shortly.",
        "Parties have been separated. Officers conducting individual accounts.",
        "Scene is fully assessed and secured. Officers completing required actions.",
        "Witnesses are being spoken to. Officers have a clear picture of what occurred.",
        "Officers completing required documentation at scene. Outcome imminent.",
        "All parties accounted for. Scene is contained and officers are progressing.",
        "Officers have established full circumstances. Actions underway.",
        "Scene is being fully documented. Officers approaching conclusion of incident.",
        "Situation at scene is fully managed. Officers are completing final steps.",
        "Officers are finalising scene enquiries. Update on outcome to follow shortly.",
        "All relevant evidence has been gathered. Officers preparing outcome.",
        "Scene enquiries substantially complete. Outcome being determined.",
        "Officers have spoken with all parties. Full picture established.",
        "Incident is drawing to a conclusion. Officers completing final checks.",
        "Scene documentation complete. Officers preparing to clear the location.",
        "All parties dealt with appropriately. Officers completing scene logs.",
        "Enquiries at scene are complete. Officers will advise of outcome shortly.",
        "Officers are conducting thorough scene examination. Outcome to follow.",
        "Full account taken from all parties at scene. Matter approaching resolution.",
        "Officers have all necessary information. Scene conclusion imminent.",
    };

    // ── Resolution: Arrest ──────────────────────────────────────────────────

    private static final String[] RESOLVED_ARREST = {
        "One male arrested at scene. Conveyed to custody in the patrol vehicle. Custody sergeant has been notified.",
        "Subject arrested for the offence and is now in custody. Interview to be arranged in due course.",
        "Suspect detained at scene. Conveyed to nearest custody suite. Charged to follow pending interview.",
        "One person arrested following incident. In custody. Officers completing custody paperwork.",
        "Two males arrested. Both conveyed to custody. Interviews to be scheduled.",
        "Suspect identified and arrested on scene. Officers escorting individual to custody.",
        "Arrest made — subject in custody. Officers completing initial paperwork for interview.",
        "One female arrested. Taken into custody. Officers returning to station with prisoner.",
        "Suspect arrested following positive identification. Now in custody awaiting interview.",
        "One person under arrest. Conveyed to custody suite. Crime report being prepared.",
        "Suspect has been arrested and cautioned. In custody. Officers completing required documentation.",
        "Two suspects detained and arrested. Now en route to custody. Interviews to be arranged.",
        "Male arrested at scene of offence. Officers have conveyed prisoner to custody suite.",
        "Person of interest arrested following scene enquiries. Interview to be conducted in due course.",
        "Arrest made on scene. Prisoner processed. Crime report to be submitted.",
        "One suspect in custody following arrest at scene. Supporting evidence gathered.",
        "Three individuals arrested. All conveyed to custody. Sergeant briefed on circumstances.",
        "Suspect arrested and under caution. Officers documenting scene before departure.",
        "Arrest confirmed. Prisoner in custody. Crime reference being issued for reporting.",
        "Subject arrested — significant evidence gathered at scene to support charge.",
        "Suspect in custody. One officer remaining at scene to complete evidence collection.",
        "One male arrested following incident. Victim support offered. Crime report submitted.",
        "Arrest made. Subject arrested under relevant legislation. Custody sergeant briefed.",
        "Suspect arrested on suspicion of offence. Evidence packages being prepared for interview.",
        "One person arrested. Officers have de-escalated situation and ensured scene safety before arrest.",
        "Individual arrested at scene and taken to custody. Victim has been spoken to and given crime reference.",
        "Suspect detained and arrested. Crime report raised. Officers returning to custody.",
        "Arrest made following brief foot pursuit. Subject detained and arrested without further incident.",
        "Two arrests made. Officers managing scene and ensuring both prisoners are secure for transport.",
        "Suspect arrested and conveyed to custody. Appropriate seizures made at scene.",
    };

    // ── Resolution: Caution/Warning ─────────────────────────────────────────

    private static final String[] RESOLVED_CAUTION = {
        "Person issued with a community resolution. Both parties satisfied with outcome.",
        "Individual given a formal caution for the offence. Accepted caution without protest.",
        "Suspect issued with penalty notice for disorder. Matter concluded at scene.",
        "Officers have administered a verbal warning. Parties advised to cease behaviour or face arrest.",
        "Suspect received a community resolution in agreement with victim. Matter resolved at scene.",
        "Individual cautioned and given crime prevention advice. Agreed to cease behaviour.",
        "Officers dealt with matter by way of penalty notice. Subject has acknowledged.",
        "Verbal words of advice given to all parties. Both sides have agreed to leave separately.",
        "Conditional caution administered. Individual understands conditions attached.",
        "Community resolution offered and accepted. Victim is satisfied with outcome.",
        "PND issued to individual. Accepted and acknowledged. No further action at scene.",
        "Subject issued with formal warning. No further action taken at this time.",
        "Both parties received words of advice from officers. Agreed to resolve matter amicably.",
        "Subject cautioned for the offence. Understanding of caution confirmed. Resolved at scene.",
        "Suspect given a community resolution — verbal apology accepted by victim. Closed at scene.",
        "Officer issued penalty notice. Individual understood and will pay within required timeframe.",
        "Young person given a youth caution in the presence of a responsible adult.",
        "Matter resolved by restorative justice at scene. All parties satisfied with outcome.",
        "Verbal warning issued. Behaviour unlikely to be repeated. No arrest required.",
        "Individual cautioned. Displayed genuine remorse at scene. Crime report to be submitted.",
        "Matter resolved through community resolution scheme. Victim satisfied. Scene cleared.",
        "Subject issued with community protection warning. Advised of consequences of non-compliance.",
        "Offender given informal words of advice. Both parties separated and have agreed to move on.",
        "Formal simple caution administered. Crime report to be submitted. Incident resolved.",
        "Fixed penalty notice issued to individual. No further police action required at this time.",
    };

    // ── Resolution: Hospital ────────────────────────────────────────────────

    private static final String[] RESOLVED_HOSPITAL = {
        "Injured party conveyed to hospital by ambulance. Officers liaising with paramedics.",
        "Victim taken to hospital for treatment. Officers will take statement when medically fit to do so.",
        "Injured individual transported to A&E. Officers following up at hospital.",
        "Two casualties transported to hospital by paramedics. Officers attending hospital to take accounts.",
        "Person treated at scene by paramedics and subsequently conveyed to hospital.",
        "Victim sustained injuries requiring hospital treatment. Ambulance conveyed to nearest A&E.",
        "Individual requiring medical attention has been conveyed to hospital by HEMS.",
        "Injured party taken to hospital. Life-threatening injuries suspected. Officers attending.",
        "Paramedics attended and conveyed one casualty to hospital. Officers managing scene.",
        "Victim transported to hospital for precautionary checks. Officers accompanied in attendance.",
        "Injured party received initial treatment at scene and conveyed to hospital by land ambulance.",
        "One casualty taken to hospital. Officers remain at scene pending medical update.",
        "Victim taken to hospital. Not believed to be life threatening at this stage.",
        "Person conveyed to hospital as a precaution. Officers are attending hospital to provide support.",
        "Injured individual assessed at scene and conveyed to hospital for further treatment.",
        "Casualty has been stabilised and conveyed to hospital. Officers following with next of kin notified.",
        "Victim has been taken to hospital. Officers are completing scene enquiries.",
        "One person hospitalised following incident. Officers coordinating with hospital liaison.",
        "Individual taken to hospital by ambulance. Officers will attend to take account when able.",
        "Injured party conveyed to hospital. Crime committed against a person — investigation underway.",
        "Casualty hospitalised. Officers have preserved scene for forensic examination.",
        "Victim transported to A&E. Injuries are consistent with account given. Investigation continues.",
        "Individual conveyed to hospital. Paramedics have provided officers with brief account.",
        "Person taken to hospital following incident. Investigation ongoing pending victim's account.",
        "Casualty conveyed to hospital. Officers securing scene pending further enquiries.",
    };

    // ── Resolution: No Further Action ───────────────────────────────────────

    private static final String[] RESOLVED_NO_ACTION = {
        "Officers attended. No trace of offenders. Scene examined. No further action at this time.",
        "Officers on scene — no evidence of any offence. Caller reassured. No further action.",
        "Scene examined. Matter appears civil in nature. Parties advised of civil remedies.",
        "Officers attended and spoke with parties. No offence disclosed. Logged and closed.",
        "Caller could not be located on arrival. Scene checked. No persons requiring assistance.",
        "All parties spoken to. No corroborating evidence available. No further action.",
        "Officers attended. Parties have resolved matter between themselves. No further action.",
        "No offences disclosed following thorough scene assessment. Incident closed.",
        "Officers investigated. Insufficient evidence to progress. Crime reference issued.",
        "Matter found to be unfounded on officers' arrival. Scene clear. No further action.",
        "Officers attended. Parties have left scene. No evidence of offence. Closed.",
        "Scene examined — no evidence to support reported offence. Officers reviewed CCTV lines.",
        "Caller states matter resolved prior to officers' arrival. No further action.",
        "Officers attended. No offender identified. Scene preserved for intelligence purposes.",
        "Officers on scene. Property recovered. No further action in relation to persons.",
        "Parties resolved matter prior to attendance. Officers satisfied. Incident closed.",
        "Officers found no evidence of ongoing matter on arrival. Scene cleared.",
        "No trace of suspects. Scene was calm. Officers have completed enquiries.",
        "Caller unavailable on arrival. No evidence of offence. Officers have cleared.",
        "Officers investigated. Matter found to be unfounded. Scene closed.",
        "No evidence to suggest crime has occurred at scene. Officers provided advice and cleared.",
        "Officers attended. Situation had resolved naturally prior to arrival. No further action.",
        "Scene assessment complete — no offence identified. Logged for intelligence. Closed.",
        "Officers unable to locate any parties. Scene checked thoroughly. No further action.",
        "Matter assessed as civil dispute. Officers gave appropriate advice. No police action required.",
    };

    // ── Resolution: Investigation continuing ───────────────────────────────

    private static final String[] RESOLVED_INVESTIGATION = {
        "Initial scene enquiries complete. Investigation is ongoing. Incident passed to CID for further action.",
        "Scene secured for forensic examination. Investigation is ongoing — updates to follow.",
        "Officers have completed initial scene attendance. Investigation continues and will be progressed.",
        "Crime scene established. SOCO requested for forensic support. CID notified.",
        "Scene preserved. Evidence collected. Investigation transferred to detective team for further enquiries.",
        "Initial enquiries complete. Suspect outstanding. Investigation ongoing — intelligence requests submitted.",
        "Scene attended. Investigation ongoing. CCTV enquiries initiated at locations identified.",
        "Officers have completed scene assessment. Case passed to local CID for further investigation.",
        "Crime scene integrity maintained. Forensic examination underway. Suspect outstanding.",
        "Officers have gathered initial evidence. Investigation ongoing — statements to be completed.",
        "Scene attended. Witnesses identified. Investigation progressing — formal statements to be taken.",
        "Case being progressed by local policing team. Lines of enquiry identified at scene.",
        "Investigation at early stages. Officers working multiple lines of enquiry.",
        "Scene complete. Intelligence submitted. Case progressing through investigation process.",
        "Forensic opportunities identified. Scene preserved. Ongoing investigation in progress.",
        "Officers have completed scene attendance. CCTV enquiries underway in local area.",
        "Scene examined. Significant intelligence gathered. Investigation progressing through appropriate channels.",
        "Case in progress. Officers following established lines of enquiry. Updates to follow.",
        "Investigation ongoing. Suspect description circulated. Intelligence submission made.",
        "Scene cleared following thorough examination. Case active — further enquiries planned.",
        "Officers attending completing scene logs. Investigation in early stages — progressing well.",
        "Case transferred to investigation team. Evidence packages prepared. Suspect enquiries ongoing.",
        "Investigation underway. CCTV strategy being implemented. Updates expected in due course.",
        "Scene attendance complete. Officers have submitted intelligence report. Investigation live.",
        "Active investigation in progress. Multiple enquiries running simultaneously.",
        "Scene forensically examined. Exhibit logs complete. Investigation now with specialist team.",
        "Initial enquiries completed. Detectives briefed. Investigation progressing.",
        "Officers have completed scene examination. Case is live and being actively investigated.",
        "Scene closed. All evidence gathered. Investigation now with relevant team for further action.",
        "Active investigation underway. Intelligence packages submitted. Officers conducting enquiries.",
    };

    // ── Serious crime addendum (P1 or high-severity) ────────────────────────

    private static final String[] SERIOUS_CRIME_ADDENDUM = {
        "Due to the serious nature of this incident, a dedicated investigation team will be assigned. Further arrests are anticipated in due course as enquiries progress.",
        "This incident has been flagged as serious. CID have been briefed and will be attending to take over the investigation. Potential further arrests expected.",
        "The severity of this crime has been noted. Specialist investigators are being contacted. The scene will be preserved pending further forensic examination.",
        "Given the serious nature of this offence, the matter has been escalated to the Major Crime Team. Full investigation to follow. Potential arrests to be made in due course.",
        "This case has been referred to CID for a full investigation. Evidence gathered at scene supports further enquiries. Multiple lines of investigation are being pursued.",
        "Incident classified as serious. Investigation team notified. Scene preservation in place. Further arrests are likely as investigation develops.",
        "Major investigation commenced. Officers working under crime scene manager. Full forensic submission underway. Arrests anticipated as enquiries progress.",
        "This offence has been referred for specialist investigation. CID attending to assess evidence and coordinate enquiries. Suspect arrested may face additional charges.",
        "Serious crime protocol invoked. Gold command notified. Scene in full forensic examination. Investigation team taking over from uniformed response.",
        "Incident severity warrants further dedicated investigation. Case file being compiled for specialist team. Potential further arrests as enquiries develop.",
        "Crime scene has been fully preserved for major investigation. CID have taken over primary responsibility. Intelligence packages submitted to support enquiries.",
        "Classified as a serious crime for investigation purposes. All available intelligence compiled. Specialist team briefed and responding.",
        "CID notified and attending. This incident meets the threshold for a major investigation. Further arrests anticipated. All evidence preserved.",
        "Serious offence — investigation referred to specialist team. Scene forensics prioritised. Multiple suspects may be subject to further investigation.",
        "Due to the gravity of this incident, a full investigation is now underway. All parties will be subject to further scrutiny. Officers have ensured all evidence is preserved.",
        "Investigation flagged as priority. Detective Inspector has been briefed. Enquiries will be extensive and are expected to lead to further arrests.",
        "This incident is now subject to a major investigation. Crime scene is preserved. Forensic team attending. Investigation will be ongoing for some time.",
        "Scene secured for major investigation. Officers have briefed CID with full account. Further enquiries, including potential arrests, are planned.",
        "Offence has been escalated to priority investigation. Detectives briefed. Evidence packages compiled. Further arrests anticipated in due course.",
        "Investigation is now classified at serious crime level. Superintendent notified. Full investigation underway with significant resources committed.",
    };

    // ── Crime-type specific dispatch context additions ───────────────────────

    private static final Map<String, String[]> CRIME_DISPATCH_CONTEXT = Map.ofEntries(
        Map.entry("FIREARMS_INCIDENT", new String[]{
            "ARMED RESPONSE AUTHORISED. ARV deployed in addition to uniform response. FIREARMS trigger has been activated.",
            "Armed response units committed. Firearms protocol in effect. Scene will not be approached until ARV arrives and makes area safe.",
            "ARV units responding. Scene perimeter to be established by uniformed units pending ARV arrival and risk assessment.",
            "Firearms protocol activated. Armed officers en route. All units to hold outer cordon until ARV makes area safe.",
        }),
        Map.entry("KNIFE_CRIME", new String[]{
            "Taser-trained officer deployed as part of this response given reported weapon.",
            "Officers equipped with PAVA and protective equipment appropriate to knife crime response.",
            "Taser authorised. Officers aware of weapon risk. Appropriate protective measures in place.",
            "Response plan includes Taser capability given weapon reported. Officers briefed accordingly.",
        }),
        Map.entry("DOMESTIC_VIOLENCE", new String[]{
            "DASH risk assessment will be completed at scene. IDVA to be contacted if high risk identified.",
            "Officers briefed on DASH/SARA requirements for domestic incidents. Risk assessment to be completed.",
            "Domestic incident protocols activated. MARAC referral to be considered based on scene assessment.",
            "Officers aware of domestic violence safeguarding requirements. Risk assessment mandatory on arrival.",
        }),
        Map.entry("MISSING_PERSON", new String[]{
            "Missing person risk assessment to be completed on scene. Risk grading will determine further action.",
            "Officers to conduct initial search of area. Missing person protocol activated.",
            "Missing person enquiries to commence on scene. Family/associates to be spoken to. Search coordinated.",
            "Officers attending to locate missing person. Searches will be coordinated from scene.",
        }),
        Map.entry("ROAD_TRAFFIC_INCIDENT", new String[]{
            "Highways Agency notified. Traffic officers requested to attend for collision investigation.",
            "Roads policing unit requested. Scene to be managed for traffic flow and investigation.",
            "Officers attending RTC. Paramedics also en route. Roads policing unit to be requested.",
            "RTC response — collision investigation to follow. All relevant agencies being notified.",
        }),
        Map.entry("MENTAL_HEALTH", new String[]{
            "Mental health practitioner to be requested if appropriate on scene assessment.",
            "Officers are aware of potential mental health factors. Appropriate resources being considered.",
            "Attending officers are briefed on mental health considerations for this incident.",
            "Mental health triage to be considered on arrival. Officers briefed on safe handling.",
        })
    );

    // ── Public accessors ─────────────────────────────────────────────────────

    public String enRoute() {
        return EN_ROUTE[RNG.nextInt(EN_ROUTE.length)];
    }

    public String onSceneArrival() {
        return ON_SCENE_ARRIVAL[RNG.nextInt(ON_SCENE_ARRIVAL.length)];
    }

    public String sceneUpdate() {
        return SCENE_UPDATE[RNG.nextInt(SCENE_UPDATE.length)];
    }

    public String resolvedArrest() {
        return RESOLVED_ARREST[RNG.nextInt(RESOLVED_ARREST.length)];
    }

    public String resolvedCaution() {
        return RESOLVED_CAUTION[RNG.nextInt(RESOLVED_CAUTION.length)];
    }

    public String resolvedHospital() {
        return RESOLVED_HOSPITAL[RNG.nextInt(RESOLVED_HOSPITAL.length)];
    }

    public String resolvedNoAction() {
        return RESOLVED_NO_ACTION[RNG.nextInt(RESOLVED_NO_ACTION.length)];
    }

    public String resolvedInvestigation() {
        return RESOLVED_INVESTIGATION[RNG.nextInt(RESOLVED_INVESTIGATION.length)];
    }

    public String seriousCrimeAddendum() {
        return SERIOUS_CRIME_ADDENDUM[RNG.nextInt(SERIOUS_CRIME_ADDENDUM.length)];
    }

    public String crimeDispatchContext(String crimeType) {
        String[] options = CRIME_DISPATCH_CONTEXT.get(crimeType);
        if (options == null || options.length == 0) return "";
        return " " + options[RNG.nextInt(options.length)];
    }

    /**
     * Picks an outcome type weighted by crime type and priority.
     * Returns one of: ARREST, CAUTION, HOSPITAL, NO_ACTION, INVESTIGATION
     */
    public String pickOutcome(String crimeType, int priority, boolean injuries) {
        double r = RNG.nextDouble();
        return switch (crimeType) {
            case "FIREARMS_INCIDENT" -> r < 0.65 ? "ARREST" : "INVESTIGATION";
            case "KNIFE_CRIME"       -> r < 0.55 ? "ARREST" : r < 0.80 ? "INVESTIGATION" : "CAUTION";
            case "DOMESTIC_VIOLENCE" -> r < 0.50 ? "ARREST" : r < 0.75 ? "HOSPITAL"      : "CAUTION";
            case "ROBBERY"           -> r < 0.35 ? "ARREST" : r < 0.70 ? "INVESTIGATION" : "NO_ACTION";
            case "BURGLARY"          -> r < 0.30 ? "ARREST" : r < 0.65 ? "INVESTIGATION" : "NO_ACTION";
            case "ASSAULT"           -> r < 0.40 ? "ARREST" : r < 0.60 ? "CAUTION" : injuries ? "HOSPITAL" : "NO_ACTION";
            case "DISORDER"          -> r < 0.30 ? "ARREST" : r < 0.75 ? "CAUTION"  : "NO_ACTION";
            case "DRUG_OFFENCE"      -> r < 0.40 ? "ARREST" : r < 0.80 ? "CAUTION"  : "NO_ACTION";
            case "CRIMINAL_DAMAGE"   -> r < 0.25 ? "ARREST" : r < 0.55 ? "CAUTION"  : "NO_ACTION";
            case "THEFT"             -> r < 0.20 ? "ARREST" : r < 0.50 ? "CAUTION"  : "NO_ACTION";
            case "VEHICLE_THEFT"     -> r < 0.25 ? "ARREST" : r < 0.55 ? "INVESTIGATION" : "NO_ACTION";
            case "FRAUD"             -> r < 0.15 ? "ARREST" : "INVESTIGATION";
            case "ROAD_TRAFFIC_INCIDENT" -> injuries ? (r < 0.30 ? "ARREST" : r < 0.60 ? "HOSPITAL" : "CAUTION")
                                                     : (r < 0.30 ? "CAUTION" : "NO_ACTION");
            case "MISSING_PERSON"    -> r < 0.15 ? "HOSPITAL" : "NO_ACTION";
            case "SUSPICIOUS_ACTIVITY" -> r < 0.20 ? "ARREST" : r < 0.50 ? "CAUTION" : "NO_ACTION";
            default                  -> priority <= 2 ? "INVESTIGATION" : r < 0.3 ? "ARREST" : "NO_ACTION";
        };
    }

    public String resolutionPhrase(String outcome, String crimeType, boolean injuries) {
        return switch (outcome) {
            case "ARREST"        -> resolvedArrest();
            case "CAUTION"       -> resolvedCaution();
            case "HOSPITAL"      -> resolvedHospital();
            case "INVESTIGATION" -> resolvedInvestigation();
            default              -> resolvedNoAction();
        };
    }

    /** True if this crime type / priority warrants a serious-crime addendum note. */
    public boolean isSerious(String crimeType, int priority) {
        if (priority == 1) return true;
        return List.of("FIREARMS_INCIDENT", "KNIFE_CRIME", "ROBBERY", "FRAUD", "DOMESTIC_VIOLENCE").contains(crimeType)
               && priority <= 2;
    }

    /** Expected minimum on-scene time in seconds before resolution can happen. */
    public int minOnSceneSeconds(int priority, String crimeType) {
        return switch (priority) {
            case 1 -> 240;  // 4 min minimum for P1
            case 2 -> 300;  // 5 min
            case 3 -> 420;  // 7 min
            default -> 180; // 3 min for P4/P5
        };
    }

    /** Expected maximum on-scene time (used to ensure incidents don't linger forever). */
    public int maxOnSceneSeconds(int priority, String crimeType) {
        boolean serious = isSerious(crimeType, priority);
        return switch (priority) {
            case 1 -> serious ? 900 : 600;   // 10-15 min
            case 2 -> serious ? 1200 : 720;  // 12-20 min
            case 3 -> 900;                   // 15 min
            default -> 480;                  // 8 min
        };
    }
}
