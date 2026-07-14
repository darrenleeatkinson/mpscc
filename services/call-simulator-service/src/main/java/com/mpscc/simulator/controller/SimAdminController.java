package com.mpscc.simulator.controller;

import com.mpscc.simulator.service.CallSimulatorService;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/internal/admin")
public class SimAdminController {

    private final CallSimulatorService sim;

    public SimAdminController(CallSimulatorService sim) {
        this.sim = sim;
    }

    @GetMapping("/rate")
    public Map<String, Object> getRate() {
        return Map.of("callsPerMinute", sim.getCallsPerMinute());
    }

    @PutMapping("/rate")
    public Map<String, Object> setRate(@RequestBody Map<String, Object> body) {
        double cpm = ((Number) body.get("callsPerMinute")).doubleValue();
        sim.setCallsPerMinute(cpm);
        return Map.of("callsPerMinute", sim.getCallsPerMinute());
    }
}
