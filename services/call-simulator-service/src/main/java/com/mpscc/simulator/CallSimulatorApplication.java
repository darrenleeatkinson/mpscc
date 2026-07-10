package com.mpscc.simulator;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.client.RestTemplate;

@SpringBootApplication
@EnableScheduling
public class CallSimulatorApplication {

    public static void main(String[] args) {
        SpringApplication.run(CallSimulatorApplication.class, args);
    }

    @Bean
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3_000);
        factory.setReadTimeout(4_000);
        RestTemplate rt = new RestTemplate(factory);
        // Nominatim usage policy requires a descriptive User-Agent
        rt.getInterceptors().add((req, body, chain) -> {
            req.getHeaders().set("User-Agent", "MPSCC-Simulator/1.0 (Metropolitan Police Command & Control prototype)");
            return chain.execute(req, body);
        });
        return rt;
    }
}
