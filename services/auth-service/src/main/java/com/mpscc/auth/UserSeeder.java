package com.mpscc.auth;

import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Seeds demo users, one per role, on first startup. Idempotent.
 * Default password for all demo accounts: police123
 */
@Component
public class UserSeeder implements CommandLineRunner {

    private final AppUserRepository repo;
    private final PasswordEncoder encoder;

    public UserSeeder(AppUserRepository repo, PasswordEncoder encoder) {
        this.repo = repo;
        this.encoder = encoder;
    }

    @Override
    public void run(String... args) {
        seed("responder", "Alex Responder", "RESPONDER", "MetCC-Bow");
        seed("dispatcher", "Sam Dispatcher", "DISPATCHER", "MetCC-Lambeth");
        seed("planner", "Jordan Planner", "PLANNER", "MetCC-Hendon");
        seed("admin", "System Admin", "RESPONDER,DISPATCHER,PLANNER,ADMIN", "MetCC-Bow");
    }

    private void seed(String username, String name, String roles, String group) {
        if (repo.findByUsername(username).isPresent()) return;
        repo.save(new AppUser(username, name, encoder.encode("police123"), roles, group, null));
    }
}
