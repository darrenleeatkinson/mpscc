package com.mpscc.auth;

import com.mpscc.shared.security.JwtService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AppUserRepository repo;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthController(AppUserRepository repo, PasswordEncoder encoder, JwtService jwt) {
        this.repo = repo;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    public record LoginRequest(String username, String password) {}

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        return repo.findByUsername(req.username())
                .filter(AppUser::isEnabled)
                .filter(u -> encoder.matches(req.password(), u.getPasswordHash()))
                .<ResponseEntity<?>>map(u -> {
                    List<String> roles = split(u.getRoles());
                    List<String> groups = split(u.getGroups());
                    String token = jwt.issue(u.getUsername(), roles, groups, u.getStationId());
                    return ResponseEntity.ok(Map.of(
                            "token", token,
                            "username", u.getUsername(),
                            "displayName", u.getDisplayName(),
                            "roles", roles,
                            "groups", groups
                    ));
                })
                .orElseGet(() -> ResponseEntity.status(401).body(Map.of("error", "Invalid credentials")));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@RequestHeader(value = "Authorization", required = false) String auth) {
        if (auth == null || !auth.startsWith("Bearer ")) return ResponseEntity.status(401).build();
        try {
            var claims = jwt.parse(auth.substring(7));
            return ResponseEntity.ok(Map.of(
                    "username", claims.getSubject(),
                    "roles", claims.getOrDefault("roles", List.of()),
                    "groups", claims.getOrDefault("groups", List.of())
            ));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
        }
    }

    private static List<String> split(String s) {
        if (s == null || s.isBlank()) return List.of();
        return Arrays.stream(s.split(",")).map(String::trim).filter(x -> !x.isEmpty()).toList();
    }
}
