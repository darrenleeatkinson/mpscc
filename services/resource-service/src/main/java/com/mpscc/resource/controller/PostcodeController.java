package com.mpscc.resource.controller;

import com.mpscc.resource.repository.PostcodeRepository;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/postcodes")
public class PostcodeController {

    private final PostcodeRepository postcodes;

    public PostcodeController(PostcodeRepository postcodes) {
        this.postcodes = postcodes;
    }

    @GetMapping
    public List<Map<String, Object>> list() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] r : postcodes.findAllWithCoordinates()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("postcode",  r[0]);
            m.put("district",  r[1]);
            m.put("borough",   r[2]);
            m.put("latitude",  r[3]);
            m.put("longitude", r[4]);
            result.add(m);
        }
        return result;
    }
}
