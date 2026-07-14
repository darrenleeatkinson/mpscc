package com.mpscc.admin;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import java.util.Map;

@RestController
@RequestMapping("/admin")
@CrossOrigin
public class AdminController {

    private final RestTemplate rest;

    @Value("${admin.simulator-url}")
    private String simUrl;

    @Value("${admin.dispatch-url}")
    private String dispatchUrl;

    public AdminController(RestTemplate rest) {
        this.rest = rest;
    }

    // ── Stats ──────────────────────────────────────────────────────────────────

    @GetMapping("/stats")
    public Map<String, Object> stats() {
        return get(dispatchUrl + "/internal/admin/stats");
    }

    // ── Simulator rate ─────────────────────────────────────────────────────────

    @GetMapping("/sim/rate")
    public Map<String, Object> getRate() {
        return get(simUrl + "/internal/admin/rate");
    }

    @PutMapping("/sim/rate")
    public Map<String, Object> setRate(@RequestBody Map<String, Object> body) {
        return put(simUrl + "/internal/admin/rate", body);
    }

    // ── On-duty officers ───────────────────────────────────────────────────────

    @PutMapping("/resources/on-duty")
    public Map<String, Object> setOnDuty(@RequestParam int count) {
        String url = UriComponentsBuilder.fromHttpUrl(dispatchUrl + "/internal/admin/on-duty")
                .queryParam("count", count).toUriString();
        return put(url, null);
    }

    // ── Incident cleanup ───────────────────────────────────────────────────────

    @PostMapping("/incidents/cleanup")
    public Map<String, Object> cleanup(@RequestParam(defaultValue = "60") int olderThanMinutes) {
        String url = UriComponentsBuilder.fromHttpUrl(dispatchUrl + "/internal/admin/cleanup")
                .queryParam("olderThanMinutes", olderThanMinutes).toUriString();
        return post(url, null);
    }

    // ── Batch dispatch ─────────────────────────────────────────────────────────

    @PostMapping("/incidents/batch-dispatch")
    public Map<String, Object> batchDispatch(@RequestParam(defaultValue = "50") int count) {
        String url = UriComponentsBuilder.fromHttpUrl(dispatchUrl + "/internal/admin/batch-dispatch")
                .queryParam("count", count).toUriString();
        return post(url, null);
    }

    // ── HTTP helpers ──────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> get(String url) {
        return rest.exchange(url, HttpMethod.GET, null,
                new ParameterizedTypeReference<Map<String, Object>>() {}).getBody();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> put(String url, Object body) {
        HttpEntity<?> entity = body != null
                ? new HttpEntity<>(body, jsonHeaders())
                : new HttpEntity<>(jsonHeaders());
        return rest.exchange(url, HttpMethod.PUT, entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}).getBody();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> post(String url, Object body) {
        HttpEntity<?> entity = body != null
                ? new HttpEntity<>(body, jsonHeaders())
                : new HttpEntity<>(jsonHeaders());
        return rest.exchange(url, HttpMethod.POST, entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}).getBody();
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        return h;
    }
}
