package com.mpscc.intake.controller;

import com.mpscc.intake.model.CallInbound;
import com.mpscc.intake.service.CallQueueService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/internal")
public class InternalFeedController {

    private final CallQueueService queue;

    public InternalFeedController(CallQueueService queue) {
        this.queue = queue;
    }

    @PostMapping("/calls")
    public ResponseEntity<Void> receive(@RequestBody CallInbound call) {
        queue.enqueue(call);
        return ResponseEntity.accepted().build();
    }
}
