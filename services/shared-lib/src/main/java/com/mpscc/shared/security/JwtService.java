package com.mpscc.shared.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.Map;

/**
 * Framework-light JWT issue/verify used by both the MVC auth-service and the
 * reactive api-gateway. Signed with HS256 from the shared JWT_SECRET.
 */
public class JwtService {

    private final SecretKey key;
    private final long ttlMillis;

    public JwtService(String secret, long ttlMillis) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttlMillis = ttlMillis;
    }

    public String issue(String username, List<String> roles, List<String> groups, Long stationId) {
        Date now = new Date();
        return Jwts.builder()
                .subject(username)
                .claim("roles", roles)
                .claim("groups", groups)
                .claim("stationId", stationId)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + ttlMillis))
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload();
    }

    @SuppressWarnings("unchecked")
    public List<String> roles(Claims claims) {
        Object r = claims.get("roles");
        return r instanceof List ? (List<String>) r : List.of();
    }

    public boolean isValid(String token) {
        try {
            parse(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public Map<String, Object> claimsMap(String token) {
        return parse(token);
    }
}
