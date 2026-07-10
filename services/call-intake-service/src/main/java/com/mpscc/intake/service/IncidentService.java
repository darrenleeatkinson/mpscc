package com.mpscc.intake.service;

import com.mpscc.intake.domain.Incident;
import com.mpscc.intake.model.CreateIncidentRequest;
import com.mpscc.intake.repository.IncidentRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class IncidentService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("ddMMyy");
    private static final ZoneId LONDON = ZoneId.of("Europe/London");

    private final IncidentRepository repository;
    private final JdbcTemplate jdbc;

    public IncidentService(IncidentRepository repository, JdbcTemplate jdbc) {
        this.repository = repository;
        this.jdbc = jdbc;
    }

    @Transactional
    public Incident create(CreateIncidentRequest req) {
        String datePart = LocalDate.now(LONDON).format(DATE_FMT);
        Long seq = jdbc.queryForObject("SELECT NEXTVAL('incident_seq')", Long.class);
        String reference = datePart + "-" + String.format("%07d", seq);

        Incident inc = new Incident();
        inc.setReference(reference);
        inc.setStatus("WAITING");
        inc.setPriority(req.getPriority());
        inc.setCallId(req.getCallId());
        inc.setCallerPhone(req.getCallerPhone());
        inc.setCallerName(req.getCallerName());
        inc.setAddress(req.getAddress());
        inc.setPostcode(req.getPostcode());
        inc.setLatitude(req.getLatitude());
        inc.setLongitude(req.getLongitude());
        inc.setCrimeType(req.getCrimeType());
        inc.setCrimeDescription(req.getCrimeDescription());
        inc.setInjuries(req.isInjuries());
        inc.setWeapons(req.isWeapons());
        inc.setSuspectsOnScene(req.isSuspectsOnScene());
        inc.setPeopleAtRisk(req.getPeopleAtRisk());
        inc.setCreatedAt(OffsetDateTime.now(LONDON));

        return repository.save(inc);
    }

    public List<Incident> recent() {
        return repository.findTop10ByOrderByCreatedAtDesc();
    }

    public long count() {
        return repository.count();
    }
}
