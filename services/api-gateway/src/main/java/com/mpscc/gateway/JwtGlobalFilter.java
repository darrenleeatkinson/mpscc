package com.mpscc.gateway;

import com.mpscc.shared.security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;

/**
 * Validates the Bearer JWT on every request except public paths, and forwards
 * the resolved identity to downstream services as X-User / X-Roles headers.
 */
@Component
public class JwtGlobalFilter implements GlobalFilter, Ordered {

    private final JwtService jwt;
    private final List<String> publicPaths;

    public JwtGlobalFilter(@Value("${mpscc.jwt.secret}") String secret,
                           @Value("${mpscc.public-paths}") String publicPaths) {
        this.jwt = new JwtService(secret, 0);
        this.publicPaths = Arrays.stream(publicPaths.split(",")).map(String::trim).toList();
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        if (exchange.getRequest().getMethod().name().equals("OPTIONS")
                || publicPaths.stream().anyMatch(path::startsWith)) {
            return chain.filter(exchange);
        }

        String auth = exchange.getRequest().getHeaders().getFirst("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            return unauthorized(exchange, "Missing bearer token");
        }
        try {
            var claims = jwt.parse(auth.substring(7));
            List<String> roles = jwt.roles(claims);
            ServerHttpRequest mutated = exchange.getRequest().mutate()
                    .header("X-User", claims.getSubject())
                    .header("X-Roles", String.join(",", roles))
                    .build();
            return chain.filter(exchange.mutate().request(mutated).build());
        } catch (Exception e) {
            return unauthorized(exchange, "Invalid token");
        }
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange, String msg) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        exchange.getResponse().getHeaders().add("Content-Type", "application/json");
        byte[] body = ("{\"error\":\"" + msg + "\"}").getBytes(StandardCharsets.UTF_8);
        DataBuffer buf = exchange.getResponse().bufferFactory().wrap(body);
        return exchange.getResponse().writeWith(Mono.just(buf));
    }

    @Override
    public int getOrder() {
        return -1;
    }
}
