package com.mpscc.intake.controller;

import com.mpscc.intake.model.CallInbound;
import com.mpscc.intake.model.CrimeAssessment;
import com.mpscc.intake.service.CallQueueService;
import com.mpscc.intake.service.CrimeAssessorService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/intake")
public class IntakeController {

    private final CallQueueService queue;
    private final CrimeAssessorService assessor;

    public IntakeController(CallQueueService queue, CrimeAssessorService assessor) {
        this.queue = queue;
        this.assessor = assessor;
    }

    @GetMapping("/queue")
    public Map<String, Object> queueStatus() {
        List<CallInbound> snap = queue.snapshot(5);
        return Map.of("queued", queue.size(), "snapshot", snap);
    }

    @PostMapping("/answer")
    public ResponseEntity<Map<String, Object>> answer() {
        Optional<CallInbound> next = queue.pollNext();
        if (next.isEmpty()) {
            return ResponseEntity.status(409).body(Map.of("error", "Queue is empty"));
        }
        CallInbound call = next.get();
        CrimeAssessment assessment = assessor.assess(call.getCallId());
        return ResponseEntity.ok(Map.of("call", call, "assessment", assessment));
    }
}
