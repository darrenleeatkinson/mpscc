-- ============================================================
-- V5: BCU structure, real station metadata, BCU-weighted
--     station capacities, officer redistribution.
--
-- Source: MPS Workforce Report March 2025 (officer FTE by BCU)
--         MPS FOI addresses-all-facilities.xlsx (Aug 2023)
-- ============================================================

-- ── 1. BCU reference table ──────────────────────────────────

CREATE TABLE IF NOT EXISTS bcus (
    code          TEXT PRIMARY KEY,   -- 2-letter MPS code
    name          TEXT NOT NULL,
    boroughs      TEXT[] NOT NULL DEFAULT '{}',
    officer_fte   INT  NOT NULL DEFAULT 0,  -- March 2025 FTE
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO bcus (code, name, boroughs, officer_fte) VALUES
  ('AS','Central South', ARRAY['Lambeth','Southwark'],                                             1476),
  ('AW','Central West',  ARRAY['Hammersmith and Fulham','Kensington and Chelsea','Westminster'],   1931),
  ('CE','Central East',  ARRAY['Hackney','Tower Hamlets'],                                         1350),
  ('CN','Central North', ARRAY['Camden','Islington'],                                              1305),
  ('EA','East Area',     ARRAY['Barking and Dagenham','Havering','Redbridge'],                     1498),
  ('NA','North Area',    ARRAY['Enfield','Haringey'],                                              1294),
  ('NE','North East',    ARRAY['Newham','Waltham Forest'],                                         1331),
  ('NW','North West',    ARRAY['Barnet','Brent','Harrow'],                                         1581),
  ('SE','South East',    ARRAY['Bexley','Greenwich','Lewisham'],                                   1670),
  ('SN','South Area',    ARRAY['Bromley','Croydon','Sutton'],                                      1554),
  ('SW','South West',    ARRAY['Kingston upon Thames','Merton','Richmond upon Thames','Wandsworth'],1500),
  ('WA','West Area',     ARRAY['Ealing','Hillingdon','Hounslow'],                                  1770)
ON CONFLICT (code) DO NOTHING;

-- ── 2. Extend stations table ────────────────────────────────

ALTER TABLE stations ADD COLUMN IF NOT EXISTS bcu_code     TEXT REFERENCES bcus(code);
ALTER TABLE stations ADD COLUMN IF NOT EXISTS address      TEXT;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS postcode     TEXT;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS station_code TEXT;

-- ── 3. Tag every existing station with its BCU code ─────────

UPDATE stations SET bcu_code = CASE borough
  WHEN 'Lambeth'                THEN 'AS'
  WHEN 'Southwark'              THEN 'AS'
  WHEN 'Hammersmith and Fulham' THEN 'AW'
  WHEN 'Kensington and Chelsea' THEN 'AW'
  WHEN 'Westminster'            THEN 'AW'
  WHEN 'Hackney'                THEN 'CE'
  WHEN 'Tower Hamlets'          THEN 'CE'
  WHEN 'Camden'                 THEN 'CN'
  WHEN 'Islington'              THEN 'CN'
  WHEN 'Barking and Dagenham'   THEN 'EA'
  WHEN 'Havering'               THEN 'EA'
  WHEN 'Redbridge'              THEN 'EA'
  WHEN 'Enfield'                THEN 'NA'
  WHEN 'Haringey'               THEN 'NA'
  WHEN 'Newham'                 THEN 'NE'
  WHEN 'Waltham Forest'         THEN 'NE'
  WHEN 'Barnet'                 THEN 'NW'
  WHEN 'Brent'                  THEN 'NW'
  WHEN 'Harrow'                 THEN 'NW'
  WHEN 'Bexley'                 THEN 'SE'
  WHEN 'Greenwich'              THEN 'SE'
  WHEN 'Lewisham'               THEN 'SE'
  WHEN 'Bromley'                THEN 'SN'
  WHEN 'Croydon'                THEN 'SN'
  WHEN 'Sutton'                 THEN 'SN'
  WHEN 'Kingston upon Thames'   THEN 'SW'
  WHEN 'Merton'                 THEN 'SW'
  WHEN 'Richmond upon Thames'   THEN 'SW'
  WHEN 'Wandsworth'             THEN 'SW'
  WHEN 'Ealing'                 THEN 'WA'
  WHEN 'Hillingdon'             THEN 'WA'
  WHEN 'Hounslow'               THEN 'WA'
  ELSE NULL
END;

-- ── 4. Patch real addresses & postcodes for known stations ──
-- Matched from MPS FOI property register (Aug 2023)

UPDATE stations SET address = '367 Brixton Road',                   postcode = 'SW9 7DD', station_code = 'LD'  WHERE name = 'Brixton';
UPDATE stations SET address = '66 Central Hill',                    postcode = 'SE19 1DT',station_code = 'LG'  WHERE name = 'Gipsy Hill';
UPDATE stations SET address = '49-51 Kennington Road',              postcode = 'SE1 7QA', station_code = 'LK'  WHERE name = 'Kennington';
UPDATE stations SET address = '176 Lavender Hill',                  postcode = 'SW11 1JX',station_code = 'WL'  WHERE name = 'Battersea';
UPDATE stations SET address = '177 Peckham High Street',            postcode = 'SE15 5SL',station_code = 'MM'  WHERE name = 'Peckham';
UPDATE stations SET address = '323 Borough High Street',            postcode = 'SE1 1JL', station_code = 'MS'  WHERE name = 'Tower Bridge Road';
UPDATE stations SET address = '12-28 Manor Place',                  postcode = 'SE17 3RL'  WHERE name = 'Walworth';
UPDATE stations SET address = '202-206 Buckingham Palace Road',     postcode = 'SW1W 9SX',station_code = 'AD'  WHERE name = 'Belgravia';
UPDATE stations SET address = 'Agar Street',                        postcode = 'WC2N 4JP',station_code = 'CX'  WHERE name = 'Charing Cross';
UPDATE stations SET address = '226 Shepherds Bush Road',            postcode = 'W6 7NX',  station_code = 'FH'  WHERE name = 'Hammersmith';
UPDATE stations SET address = '72-74 Earls Court Road',             postcode = 'W8 6EQ',  station_code = 'BD'  WHERE name = 'Kensington';
UPDATE stations SET address = '99-101 Ladbroke Road',               postcode = 'W11 3PL', station_code = 'BH'  WHERE name = 'Notting Hill';
UPDATE stations SET address = '27 Savile Row',                      postcode = 'W1S 2EX', station_code = 'CD'  WHERE name = 'West End Central';
UPDATE stations SET address = '12 Victoria Park Square',            postcode = 'E2 9NZ',  station_code = 'HT'  WHERE name = 'Bethnal Green';
UPDATE stations SET address = '111-117 Bow Road',                   postcode = 'E3 2AN',  station_code = 'HW'  WHERE name = 'Poplar';
UPDATE stations SET address = '27 West India Dock Road',            postcode = 'E14 8EZ', station_code = 'HH'  WHERE name = 'Limehouse';
UPDATE stations SET address = '4-6 Shepherdess Walk',               postcode = 'N1 7LF',  station_code = 'GD'  WHERE name = 'Hoxton';
UPDATE stations SET address = '33 Stoke Newington High Street',     postcode = 'N16 8DS', station_code = 'GN'  WHERE name = 'Stoke Newington';
UPDATE stations SET address = '60 Albany Street',                   postcode = 'NW1 4EE'                       WHERE name = 'Camden Town';
UPDATE stations SET address = '10 Lambs Conduit Street',            postcode = 'WC1N 3NR',station_code = 'EO'  WHERE name = 'Holborn';
UPDATE stations SET address = '284 Hornsey Road',                   postcode = 'N7 7QY',  station_code = 'NH'  WHERE name = 'Arsenal';
UPDATE stations SET address = '2 Tolpuddle Street',                 postcode = 'N1 0YY',  station_code = 'NI'  WHERE name = 'Islington';
UPDATE stations SET address = '10-12A Holmes Road',                 postcode = 'NW5 3AE', station_code = 'EK'  WHERE name = 'Kentish Town';
UPDATE stations SET address = '21 Fortune Green Road',              postcode = 'NW6 1DX', station_code = 'EW'  WHERE name = 'Hampstead';
UPDATE stations SET address = '1 High Street, Barkingside',         postcode = 'IG6 1QB', station_code = 'JB'  WHERE name = 'Barkingside';
UPDATE stations SET address = '561 Rainham Road South',             postcode = 'RM10 7TU',station_code = 'KG'  WHERE name = 'Dagenham';
UPDATE stations SET address = '74 Station Lane',                    postcode = 'RM12 6NA',station_code = 'KC'  WHERE name = 'Hornchurch';
UPDATE stations SET address = '270-294 High Road',                  postcode = 'IG1 1GT', station_code = 'JI'  WHERE name = 'Ilford';
UPDATE stations SET address = '19 Main Road',                       postcode = 'RM1 3BJ', station_code = 'KD'  WHERE name = 'Romford';
UPDATE stations SET address = '462 Fore Street',                    postcode = 'N9 0PW',  station_code = 'YE'  WHERE name = 'Edmonton';
UPDATE stations SET address = '41 Baker Street',                    postcode = 'EN1 3EU', station_code = 'YF'  WHERE name = 'Enfield';
UPDATE stations SET address = '94-98 Tottenham Lane',               postcode = 'N8 7EJ',  station_code = 'YR'  WHERE name = 'Hornsey';
UPDATE stations SET address = '25 Chase Side',                      postcode = 'N14 5BW', station_code = 'YS'  WHERE name = 'Southgate';
UPDATE stations SET address = '398 High Road',                      postcode = 'N17 9JA', station_code = 'YT'  WHERE name = 'Tottenham';
UPDATE stations SET address = '347 High Road',                      postcode = 'N22 8JA', station_code = 'YD'  WHERE name = 'Wood Green';
UPDATE stations SET address = 'Kings Head Hill',                    postcode = 'E4 7EA',  station_code = 'JC'  WHERE name = 'Chingford';
UPDATE stations SET address = '350-360 Romford Road',               postcode = 'E7 8BS',  station_code = 'KF'  WHERE name = 'Forest Gate';
UPDATE stations SET address = '444-448 Barking Road',               postcode = 'E13 8HJ', station_code = 'KO'  WHERE name = 'Plaistow';
UPDATE stations SET address = '18 West Ham Lane',                   postcode = 'E15 4SG', station_code = 'KS'  WHERE name = 'Stratford';
UPDATE stations SET address = 'Boreham Close, Leytonstone',         postcode = 'E11 1FE', station_code = 'JP'  WHERE name = 'Leyton';
UPDATE stations SET address = '26 High Street',                     postcode = 'EN5 5RU', station_code = 'SA'  WHERE name = 'Barnet';
UPDATE stations SET address = 'Grahame Park Way',                   postcode = 'NW9 5TW', station_code = 'SC'  WHERE name = 'Hendon';
UPDATE stations SET address = '70-74 Northolt Road',                postcode = 'HA2 0DN', station_code = 'QA'  WHERE name = 'Harrow';
UPDATE stations SET address = '38 Salisbury Road',                  postcode = 'NW6 6LT', station_code = 'QK'  WHERE name = 'Kilburn';
UPDATE stations SET address = '1 Waxwell Lane',                     postcode = 'HA5 3EJ', station_code = 'QP'  WHERE name = 'Pinner';
UPDATE stations SET address = '603 Harrow Road',                    postcode = 'HA0 2HH', station_code = 'QD'  WHERE name = 'Wembley';
UPDATE stations SET address = '2 Arnsberg Way',                     postcode = 'DA7 4QS', station_code = 'RY'  WHERE name = 'Bexleyheath';
UPDATE stations SET address = '333 Bromley Road',                   postcode = 'SE6 2RJ', station_code = 'PD'  WHERE name = 'Catford';
UPDATE stations SET address = '118-124 Amersham Vale',              postcode = 'SE14 6LG',station_code = 'PP'  WHERE name = 'Deptford';
UPDATE stations SET address = '20 Well Hall Road',                  postcode = 'SE9 6SF', station_code = 'RM'  WHERE name = 'Eltham';
UPDATE stations SET address = '43 Lewisham High Street',            postcode = 'SE13 5JZ',station_code = 'PL'  WHERE name = 'Lewisham';
UPDATE stations SET address = '200 Plumstead High Street',          postcode = 'SE18 1JY',station_code = 'RA'  WHERE name = 'Plumstead';
UPDATE stations SET address = 'Addington Village Road',             postcode = 'CR0 5AQ', station_code = 'ZA'  WHERE name = 'Addington';
UPDATE stations SET address = 'High Street',                        postcode = 'BR1 1ER', station_code = 'PY'  WHERE name = 'Bromley';
UPDATE stations SET address = '90 Windmill Road',                   postcode = 'CR0 2XP', station_code = 'ZC'  WHERE name = 'Croydon';
UPDATE stations SET address = '6 Carshalton Road',                  postcode = 'SM1 4RF', station_code = 'ZT'  WHERE name = 'Sutton';
UPDATE stations SET address = '5 & 7 High Street',                  postcode = 'KT1 1LB', station_code = 'VK'  WHERE name = 'Kingston';
UPDATE stations SET address = '520-522 Garratt Lane',               postcode = 'SW17 0NZ',station_code = 'WE'  WHERE name = 'Tooting';
UPDATE stations SET address = '146 Wandsworth High Street',         postcode = 'SW18 4JJ',station_code = 'WH'  WHERE name = 'Putney';
UPDATE stations SET address = '58 Cricket Green',                   postcode = 'CR4 4LA', station_code = 'VM'  WHERE name = 'Mitcham';
UPDATE stations SET address = '18 Park Road',                       postcode = 'TW11 0AQ',station_code = 'TT'  WHERE name = 'Teddington';
UPDATE stations SET address = '41 London Road',                     postcode = 'TW1 3SY', station_code = 'TW'  WHERE name = 'Twickenham';
UPDATE stations SET address = '15-23 Queens Road',                  postcode = 'SW19 8NN',station_code = 'VW'  WHERE name = 'Wimbledon';
UPDATE stations SET address = '250 High Street',                    postcode = 'W3 9BH',  station_code = 'XA'  WHERE name = 'Acton';
UPDATE stations SET address = '205-207 Chiswick High Road',         postcode = 'W4 2DU',  station_code = 'TC'  WHERE name = 'Chiswick';
UPDATE stations SET address = '67-69 Uxbridge Road',                postcode = 'W5 5SJ',  station_code = 'XD'  WHERE name = 'Ealing';
UPDATE stations SET address = '34 Hanworth Road',                   postcode = 'TW13 5BD',station_code = 'TF'  WHERE name = 'Feltham';
UPDATE stations SET address = '755 Uxbridge Road',                  postcode = 'UB4 8HU', station_code = 'XY'  WHERE name = 'Hayes';
UPDATE stations SET address = '122-123 High Street, Uxbridge',      postcode = 'UB8 1PG', station_code = 'XU'  WHERE name = 'Uxbridge';
UPDATE stations SET address = '3-5 Montague Road',                  postcode = 'TW3 1LB', station_code = 'TX'  WHERE name = 'Hounslow';
UPDATE stations SET address = 'The Oaks, Manor Road, Ruislip',      postcode = 'HA4 7LE', station_code = 'XR'  WHERE name = 'Ruislip';
UPDATE stations SET address = '67 High Street',                     postcode = 'UB1 3HF', station_code = 'XS'  WHERE name = 'Southall';
UPDATE stations SET address = '93-109 Lambeth Road',                postcode = 'SE1 7LP'                       WHERE name = 'Lambeth MetCC';
UPDATE stations SET address = 'Grahame Park Way, Hendon',           postcode = 'NW9 5JE'                       WHERE name = 'Hendon MetCC';

-- ── 5. Recalculate station capacity to reflect BCU officer FTE ──
-- Formula: capacity_i = (BCU_FTE / sum_all_BCU_FTE) * 40000 / stations_in_BCU
-- This makes the seeder's capacity-weighted pick produce BCU-proportional distribution.

UPDATE stations s
SET capacity = GREATEST(200,
    ROUND(
        (b.officer_fte::float / (SELECT SUM(officer_fte) FROM bcus))
        * 40000.0
        / NULLIF((
            SELECT COUNT(*) FROM stations s2
            WHERE s2.bcu_code = s.bcu_code AND s2.type = 'POLICE_STATION'
          ), 0)
    )::int
)
FROM bcus b
WHERE s.bcu_code = b.code AND s.type = 'POLICE_STATION';

-- Command centres and unclassified stations keep a small capacity so they
-- don't skew the distribution.
UPDATE stations SET capacity = 50 WHERE type = 'COMMAND_CENTRE' OR bcu_code IS NULL;

-- ── 6. Wipe existing seeded data so the seeder re-runs ──────
-- The MasterDataSeeder is guarded by seed_marker("officers").
-- Removing it causes a clean re-seed on next startup with the
-- new BCU-proportional capacities.

DELETE FROM vehicle_assignments;
DELETE FROM officer_shifts;
DELETE FROM officer_skills;
DELETE FROM vehicles;
DELETE FROM officers;
DELETE FROM seed_marker WHERE name = 'officers';
