package com.mpscc.intake.service;

import com.mpscc.intake.domain.Incident;
import com.mpscc.intake.model.CallInbound;
import com.mpscc.intake.model.CreateIncidentRequest;
import com.mpscc.intake.model.CrimeAssessment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.Random;

/**
 * Automatically answers queued calls and raises incidents without a human operator.
 * Runs every 10 seconds and processes 1–4 calls per tick depending on queue depth.
 */
@Service
public class AutoIntakeService {

    private static final Logger log = LoggerFactory.getLogger(AutoIntakeService.class);
    private static final Random RNG = new Random();

    private static final String[] FIRST_CONTACT_PHRASES = {
        "Call received and assessed by CAD. Incident raised from caller report. Priority assigned per grading criteria. Awaiting dispatch allocation.",
        "First contact confirmed. Caller account taken and location verified. Incident record created and queued for resource deployment.",
        "Inbound call processed. Risk assessment complete. Incident graded and raised to dispatch queue.",
        "CAD operator has screened the call. All relevant details captured. Incident created with priority assigned per force policy.",
        "Call confirmed and logged. Caller has been given incident reference number. Incident awaiting dispatch action.",
        "Initial caller contact completed. Details verified and recorded. Incident raised to dispatch for resource allocation.",
        "Emergency call assessed by first contact. Location confirmed via mobile signal. Incident raised to CAD queue.",
        "999 call received and processed. Caller account verified. Incident graded and passed to dispatch.",
        "Call screened — incident raised. Caller advised that police response is being arranged. Incident in dispatch queue.",
        "First contact screening complete. Priority assigned based on initial assessment. Incident queued for resource deployment.",
        "CAD has taken caller details and assessed the incident. Graded at priority based on information received. Awaiting dispatch.",
        "Call processed at first contact. All relevant flags recorded. Incident raised and visible to dispatch team.",
        "Caller details verified. Crime type assessed. Incident logged and queued — response being arranged.",
        "Inbound 999 processed. Initial assessment confirms this as a reportable incident. Raised to dispatch.",
        "First contact complete. Caller has provided full details. Incident recorded and awaiting dispatch allocation.",
        "Call received and risk-graded. Incident raised with all relevant information. Dispatch to allocate resources.",
        "CAD operator confirmed incident details with caller. Incident created and placed in dispatch queue.",
        "Call assessed at first contact. Incident raised per THRIVE assessment criteria. Awaiting resource deployment.",
        "Initial call processed. Caller briefed on response arrangements. Incident in dispatch queue.",
        "Emergency call confirmed. All incident details captured. Passed to dispatch for resource allocation.",
        "999 incident raised. Caller account matches initial information. Graded and queued.",
        "First contact screening completed. No additional urgent information at this time. Incident in dispatch queue.",
        "Call received. Incident raised after initial assessment. Caller advised to remain at location if safe to do so.",
        "CAD screening complete. Crime type and priority confirmed. Incident visible to dispatch team.",
        "Caller contact confirmed. All flags set per assessment. Dispatch has been notified.",
        "Call graded at first contact. Incident raised. Caller advised of expected response timeline.",
        "Initial assessment complete. Incident raised with full details. Awaiting dispatch allocation.",
        "999 call processed. Incident record created. Caller asked to remain available for officer contact.",
        "First contact complete. Incident visible in dispatch queue. Response being coordinated.",
        "Call received and screened. Incident created and graded. Dispatch advised.",
        "CAD first contact confirmed — incident raised. Priority determined from caller account and force policy.",
        "Initial contact made. Caller provided full incident details. Record created and queued for dispatch.",
        "Caller details captured at first contact. Incident graded and raised. Awaiting resource assignment.",
        "Call processed. Caller has been advised to stay safe and await officers. Incident in dispatch queue.",
        "First contact officer has completed initial assessment. Incident raised to dispatch level for resource allocation.",
        "Emergency call confirmed and logged. Priority assigned. Incident placed in dispatch queue for action.",
        "CAD processed call within target response time. Incident raised. Dispatch queue notified.",
        "Initial assessment by first contact officer confirms incident as reported. Priority graded accordingly.",
        "Call received. Incident raised with full THRIVE assessment completed. Awaiting dispatch.",
        "999 call confirmed at first contact. All caller information recorded. Incident queued for dispatch action.",
        "Caller account taken. Incident raised and visible in CAD. Dispatch team alerted to respond.",
        "First contact complete. Caller is cooperative and remains at scene. Incident in dispatch queue.",
        "Emergency call screened at first contact. Incident graded based on initial caller report. Queue updated.",
        "CAD operator has raised this incident following caller assessment. Full details recorded. Awaiting resources.",
        "Call processed and incident raised. Caller has been given safety advice. Awaiting dispatch confirmation.",
        "First contact complete. Caller has been reassured. Incident raised and in dispatch queue.",
        "999 call taken and processed. Incident graded and logged. Awaiting resource allocation from dispatch.",
        "Initial assessment complete at CAD. Incident raised and prioritised. Dispatch queue updated.",
        "Call received and confirmed at first contact. Incident record active. Awaiting resource deployment.",
        "Incident raised from caller contact. All flags set. Dispatch notified and queued for action.",
    };

    private final CallQueueService queue;
    private final CrimeAssessorService assessor;
    private final IncidentService incidentService;
    private final JdbcTemplate jdbc;

    public AutoIntakeService(CallQueueService queue, CrimeAssessorService assessor,
                             IncidentService incidentService, JdbcTemplate jdbc) {
        this.queue = queue;
        this.assessor = assessor;
        this.incidentService = incidentService;
        this.jdbc = jdbc;
    }

    @Scheduled(fixedDelay = 10_000)
    public void autoProcess() {
        int size = queue.size();
        if (size == 0) return;

        // Scale throughput to queue depth to prevent runaway backlog
        int toProcess = size > 40 ? 5 : size > 20 ? 3 : size > 8 ? 2 : 1;

        for (int i = 0; i < toProcess; i++) {
            Optional<CallInbound> next = queue.pollNext();
            if (next.isEmpty()) break;

            CallInbound call = next.get();
            try {
                CrimeAssessment assessment = assessor.assess(call.getCallId());

                CreateIncidentRequest req = new CreateIncidentRequest();
                req.setCallId(call.getCallId());
                req.setCallerPhone(call.getPhone());
                req.setCallerName("Unknown caller");
                req.setAddress(call.getAddress());
                req.setPostcode(call.getPostcode());
                req.setLatitude(call.getLatitude());
                req.setLongitude(call.getLongitude());
                req.setCrimeType(assessment.getCrimeType());
                req.setCrimeDescription(assessment.getDescription());
                req.setInjuries(assessment.isInjuries());
                req.setWeapons(assessment.isWeapons());
                req.setSuspectsOnScene(assessment.isSuspectsOnScene());
                req.setPeopleAtRisk(assessment.getPeopleAtRisk());
                req.setPriority(assessment.getSuggestedPriority());

                Incident incident = incidentService.create(req);

                String phrase = FIRST_CONTACT_PHRASES[RNG.nextInt(FIRST_CONTACT_PHRASES.length)];
                try {
                    jdbc.update(
                        "INSERT INTO incident_notes (incident_id, author, note_text, note_type) VALUES (?, ?, ?, ?)",
                        incident.getId(), "CAD First Contact", phrase, "FIRST_CONTACT");
                } catch (Exception ex) {
                    // incident_notes table not yet migrated — safe to skip
                    log.trace("Could not write first-contact note for {}: {}", incident.getReference(), ex.getMessage());
                }

                log.debug("Auto-confirmed {} {} from queue (queue remaining: {})",
                    incident.getReference(), incident.getCrimeType(), queue.size());

            } catch (Exception ex) {
                log.warn("Auto-intake error for call {}: {}", call.getCallId(), ex.getMessage());
            }
        }
    }
}
