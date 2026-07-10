package com.mpscc.resource.seed;

import com.mpscc.resource.domain.SeedMarker;
import com.mpscc.resource.repository.SeedMarkerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.*;

/**
 * Seeds 40,000 officers, ~10,390 vehicles, and officer skills on first startup.
 * Guarded by seed_marker — safe to restart.
 */
@Component
public class MasterDataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(MasterDataSeeder.class);

    private static final String[] MALE_FIRST = {
        "James","William","Robert","John","Michael","David","Christopher","Daniel","Thomas","Matthew",
        "Andrew","Mark","Paul","Stephen","Kevin","Richard","Edward","George","Anthony","Brian",
        "Charles","Simon","Patrick","Peter","Ian","Philip","Steven","Timothy","Jonathan","Martin",
        "Oliver","Benjamin","Samuel","Henry","Alexander","Luke","Ryan","Adam","Sean","Nathan"
    };
    private static final String[] FEMALE_FIRST = {
        "Emma","Sarah","Claire","Laura","Rebecca","Jennifer","Lucy","Katherine","Helen","Victoria",
        "Rachel","Charlotte","Elizabeth","Emily","Natasha","Samantha","Nicole","Michelle","Catherine","Louise",
        "Marie","Julia","Olivia","Sophie","Hannah","Amy","Jessica","Megan","Alice","Fiona",
        "Eleanor","Grace","Abigail","Harriet","Imogen","Joanna","Karen","Lisa","Natalie","Patricia"
    };
    private static final String[] SURNAMES = {
        "Smith","Jones","Williams","Brown","Taylor","Davies","Evans","Wilson","Thomas","Roberts",
        "Johnson","Lewis","Walker","Robinson","White","Thompson","Hughes","Clark","Martin","Wood",
        "Harris","Jackson","Hall","Edwards","Green","Turner","Young","Moore","Hill","Collins",
        "Parker","Price","Campbell","Mitchell","Bailey","Cooper","Morris","Ward","Cox","Richardson",
        "Howard","Watson","Brooks","Kelly","Gray","Harrison","Fisher","King","Barnes","Ross",
        "Patel","Khan","Ali","Ahmed","Singh","Sharma","Begum","Hussain","Islam","Rahman"
    };

    // Rank distribution: 40,000 total
    // PC=28000 PS=4000 INSP=1600 CI=800 DC=3200 DS=1600 DI=800
    private static final String[] RANK_POOL = buildRankPool();

    private static String[] buildRankPool() {
        String[] pool = new String[40_000];
        int idx = 0;
        for (int i = 0; i < 28_000; i++) pool[idx++] = "PC";
        for (int i = 0; i <  4_000; i++) pool[idx++] = "PS";
        for (int i = 0; i <  1_600; i++) pool[idx++] = "INSP";
        for (int i = 0; i <    800; i++) pool[idx++] = "CI";
        for (int i = 0; i <  3_200; i++) pool[idx++] = "DC";
        for (int i = 0; i <  1_600; i++) pool[idx++] = "DS";
        for (int i = 0; i <    800; i++) pool[idx++] = "DI";
        return pool;
    }

    private record VehicleSpec(String type, int count, int seats, String prefix) {}

    private static final VehicleSpec[] FLEET = {
        new VehicleSpec("CAR",       8_000, 2, null),
        new VehicleSpec("VAN",       1_000, 8, null),
        new VehicleSpec("MOTORBIKE",   500, 1, "MB"),
        new VehicleSpec("SCOOTER",     200, 1, "SC"),
        new VehicleSpec("PUSHBIKE",    600, 1, "PB"),
        new VehicleSpec("DOG_CAR",      60, 2, "DC"),
        new VehicleSpec("HORSE",        30, 1, "HS"),
    };

    private final JdbcTemplate jdbc;
    private final SeedMarkerRepository markers;
    private final Random rng = new Random(42L);

    public MasterDataSeeder(JdbcTemplate jdbc, SeedMarkerRepository markers) {
        this.jdbc = jdbc;
        this.markers = markers;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (markers.existsById("officers")) {
            log.info("Master data already seeded — skipping.");
            return;
        }
        log.info("Seeding master data…");
        long t0 = System.currentTimeMillis();

        long[]  stationIds = loadStationIds();
        long[]  cumulative = buildCumulative(loadStationWeights(stationIds));
        int     totalWeight = (int) cumulative[cumulative.length - 1];

        seedOfficers(stationIds, cumulative, totalWeight);
        assignSkills();
        seedVehicles(stationIds, cumulative, totalWeight);

        markers.save(new SeedMarker("officers", 40_000L));
        log.info("Seed complete in {}ms", System.currentTimeMillis() - t0);
    }

    // ---- officers --------------------------------------------------------

    private void seedOfficers(long[] stationIds, long[] cumulative, int totalWeight) {
        log.info("Batch-inserting 40,000 officers…");
        final int TOTAL    = 40_000;
        final int FIREARMS = 6_000;
        final int BATCH    = 500;

        int firearmsIssued = 0;

        for (int base = 0; base < TOTAL; base += BATCH) {
            final int from = base;
            final int to   = Math.min(base + BATCH, TOTAL);
            final int size = to - from;

            // Build row data
            final Object[][] rows = new Object[size][8];
            for (int j = 0; j < size; j++) {
                int seq     = from + j + 1;
                String rank = RANK_POOL[seq - 1];
                boolean fire = firearmsIssued < FIREARMS && isFirearmsEligible(rank);
                if (fire) firearmsIssued++;
                rows[j] = new Object[]{
                    String.format("%s-%05d", rank, seq),
                    pickForename(seq),
                    SURNAMES[rng.nextInt(SURNAMES.length)],
                    rank,
                    pickStation(stationIds, cumulative, totalWeight),
                    pickMode(rank),
                    fire,
                    "OFF_DUTY"
                };
            }

            jdbc.batchUpdate(
                "INSERT INTO officers " +
                "(collar_number,forename,surname,rank,home_station,default_mode,is_firearms,status) " +
                "VALUES (?,?,?,?,?,?,?,?)",
                new BatchPreparedStatementSetter() {
                    @Override
                    public void setValues(PreparedStatement ps, int i) throws SQLException {
                        ps.setString(1,  (String)  rows[i][0]);
                        ps.setString(2,  (String)  rows[i][1]);
                        ps.setString(3,  (String)  rows[i][2]);
                        ps.setString(4,  (String)  rows[i][3]);
                        ps.setLong(5,    (Long)     rows[i][4]);
                        ps.setString(6,  (String)  rows[i][5]);
                        ps.setBoolean(7, (Boolean)  rows[i][6]);
                        ps.setString(8,  (String)  rows[i][7]);
                    }
                    @Override public int getBatchSize() { return size; }
                });
        }
        log.info("Officers inserted.");
    }

    // ---- skills (SQL-level — fast, no per-row Java logic) ---------------

    private void assignSkills() {
        log.info("Assigning officer skills…");
        Map<String, Integer> skillIds = loadSkillIds();

        // FIREARMS: all officers flagged is_firearms=true
        bulkSkill("is_firearms = TRUE", skillIds.get("FIREARMS"));

        // ADVANCED_DRIVER: 5% random sample
        bulkSkill("random() < 0.05", skillIds.get("ADVANCED_DRIVER"));

        // PUBLIC_ORDER: 10% random
        bulkSkill("random() < 0.10", skillIds.get("PUBLIC_ORDER"));

        // DETECTIVE: all DC/DS/DI
        bulkSkill("rank IN ('DC','DS','DI')", skillIds.get("DETECTIVE"));

        // SENIOR_DETECTIVE: all DS/DI
        bulkSkill("rank IN ('DS','DI')", skillIds.get("SENIOR_DETECTIVE"));

        // MURDER_INVESTIGATION: all DI
        bulkSkill("rank = 'DI'", skillIds.get("MURDER_INVESTIGATION"));

        // DOG_HANDLER: officers with DOG_CAR mode
        bulkSkill("default_mode = 'DOG_CAR'", skillIds.getOrDefault("DOG_HANDLER", -1));

        // MEDICAL_FIRST_AID: 3% random
        bulkSkill("random() < 0.03", skillIds.get("MEDICAL_FIRST_AID"));

        // NEGOTIATOR: tiny subset (0.5%)
        bulkSkill("random() < 0.005", skillIds.get("NEGOTIATOR"));
    }

    private void bulkSkill(String predicate, Integer skillId) {
        if (skillId == null || skillId < 0) return;
        jdbc.update("""
                INSERT INTO officer_skills (officer_id, skill_id)
                SELECT id, ? FROM officers WHERE %s
                ON CONFLICT DO NOTHING
                """.formatted(predicate), skillId);
    }

    // ---- vehicles --------------------------------------------------------

    private void seedVehicles(long[] stationIds, long[] cumulative, int totalWeight) {
        log.info("Inserting ~10,390 vehicles…");
        int carSeq = 0, assetSeq = 0;

        for (VehicleSpec spec : FLEET) {
            List<Object[]> batch = new ArrayList<>(spec.count());
            for (int i = 0; i < spec.count(); i++) {
                long stationId = pickStation(stationIds, cumulative, totalWeight);
                String id = spec.prefix() == null
                        ? syntheticReg(++carSeq)
                        : String.format("%s-%06d", spec.prefix(), ++assetSeq);
                batch.add(new Object[]{spec.type(), id, spec.seats(), stationId, "AVAILABLE"});
            }

            final List<Object[]> rows = batch;
            jdbc.batchUpdate(
                "INSERT INTO vehicles (type, identifier, seats, home_station, status) VALUES (?,?,?,?,?)",
                new BatchPreparedStatementSetter() {
                    @Override
                    public void setValues(PreparedStatement ps, int i) throws SQLException {
                        ps.setString(1,  (String)  rows.get(i)[0]);
                        ps.setString(2,  (String)  rows.get(i)[1]);
                        ps.setInt(3,     (Integer) rows.get(i)[2]);
                        ps.setLong(4,    (Long)    rows.get(i)[3]);
                        ps.setString(5,  (String)  rows.get(i)[4]);
                    }
                    @Override public int getBatchSize() { return rows.size(); }
                });
        }
    }

    // ---- helpers ---------------------------------------------------------

    private long[] loadStationIds() {
        return jdbc.queryForList("SELECT id FROM stations ORDER BY id", Long.class)
                   .stream().mapToLong(Long::longValue).toArray();
    }

    private int[] loadStationWeights(long[] ids) {
        int[] w = new int[ids.length];
        for (int i = 0; i < ids.length; i++) {
            w[i] = Objects.requireNonNull(
                    jdbc.queryForObject("SELECT capacity FROM stations WHERE id=?", Integer.class, ids[i]));
        }
        return w;
    }

    private long[] buildCumulative(int[] weights) {
        long[] c = new long[weights.length];
        c[0] = weights[0];
        for (int i = 1; i < weights.length; i++) c[i] = c[i - 1] + weights[i];
        return c;
    }

    private Map<String, Integer> loadSkillIds() {
        Map<String, Integer> map = new HashMap<>();
        jdbc.query("SELECT id, code FROM skills", rs -> {
            map.put(rs.getString("code"), rs.getInt("id"));
        });
        return map;
    }

    private long pickStation(long[] stationIds, long[] cumulative, int totalWeight) {
        long target = (long) (rng.nextDouble() * totalWeight);
        int idx = Arrays.binarySearch(cumulative, target);
        if (idx < 0) idx = -idx - 1;
        return stationIds[Math.min(idx, stationIds.length - 1)];
    }

    private boolean isFirearmsEligible(String rank) {
        return rank.equals("PC") || rank.equals("DC") || rank.equals("PS");
    }

    private String pickForename(int seq) {
        return (seq % 10 < 7)
                ? MALE_FIRST[rng.nextInt(MALE_FIRST.length)]
                : FEMALE_FIRST[rng.nextInt(FEMALE_FIRST.length)];
    }

    private String pickMode(String rank) {
        return switch (rank) {
            case "DC","DS","DI" -> rng.nextInt(10) < 6 ? "CAR" : "FOOT";
            default             -> rng.nextInt(10) < 6 ? "FOOT" : "CAR";
        };
    }

    private static final String[] AREA_CODES = {
        "LA","LB","LC","LD","LE","LF","LG","LH","LJ","LK","LL","LM","LN","LP","LR","LS","LT","LU","LV","LW","LX","LY"
    };
    private static final String[] YEAR_CODES = {"21","22","23","24","71","72","73","74"};
    private static final String[] REG_LETTERS = {
        "A","B","C","D","E","F","G","H","J","K","L","M","N","P","R","S","T","U","V","W","X","Y"
    };

    private String syntheticReg(int seq) {
        String area = AREA_CODES[seq % AREA_CODES.length];
        String year = YEAR_CODES[(seq / AREA_CODES.length) % YEAR_CODES.length];
        String l1   = REG_LETTERS[(seq / 100) % REG_LETTERS.length];
        String l2   = REG_LETTERS[(seq / 10)  % REG_LETTERS.length];
        String l3   = REG_LETTERS[seq          % REG_LETTERS.length];
        return area + year + " " + l1 + l2 + l3;
    }
}
