package com.mpscc.resource.controller;

import com.mpscc.resource.domain.Vehicle;
import com.mpscc.resource.repository.VehicleRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/vehicles")
public class VehicleController {

    private final VehicleRepository vehicles;

    public VehicleController(VehicleRepository vehicles) {
        this.vehicles = vehicles;
    }

    @GetMapping
    public Page<Vehicle> list(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) Long station,
            @RequestParam(required = false) String status) {
        return vehicles.findFiltered(type, station, status,
                PageRequest.of(page, size, Sort.by("type", "identifier")));
    }

    @GetMapping("/count")
    public Map<String, Object> count() {
        return Map.of(
                "total",     vehicles.count(),
                "CAR",       vehicles.countByType("CAR"),
                "VAN",       vehicles.countByType("VAN"),
                "MOTORBIKE", vehicles.countByType("MOTORBIKE"),
                "SCOOTER",   vehicles.countByType("SCOOTER"),
                "PUSHBIKE",  vehicles.countByType("PUSHBIKE"),
                "DOG_CAR",   vehicles.countByType("DOG_CAR"),
                "HORSE",     vehicles.countByType("HORSE")
        );
    }
}
