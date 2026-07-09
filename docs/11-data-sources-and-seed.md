# 11 — Data Sources & Seed Data

All data is **synthetic**; where real reference data helps realism we use open datasets and note
provenance. Nothing here is real personal data.

## 11.1 M25 postcodes (fixed set)
- **Need:** ~5,000 Greater London postcode districts with centroid lat/long, tagged inside-M25.
- **Source options (open):**
  - ONS Postcode Directory (ONSPD) — open, has lat/long per postcode.
  - `doogal.co.uk` London postcode CSVs (lat/long, borough).
  - OSM Nominatim / Overpass for borough boundaries.
- **Seed approach:** load a curated CSV into `postcodes`; flag `inside_m25` via a polygon
  point-in-poly test against an M25 boundary GeoJSON. Fallback: bounding box around London if the
  precise M25 polygon isn't handy for the prototype.

## 11.2 Police stations & command centres (110 + 3)
- **Need:** name, type, borough, address, lat/long, size band for 110 stations + 3 command
  centres.
- **Source:** met.police.uk station finder pages (public); OSM `amenity=police` for London gives
  coordinates for most stations.
- **Command centres:** the three MetCC sites — **Bow, Lambeth, Hendon** — added explicitly as
  `COMMAND_CENTRE` rows with real approximate coordinates.
- **Scraping note:** a small one-off scraper (or manual CSV) collects station names/addresses;
  geocode via Nominatim. Size band assigned by a simple rule (central/large boroughs → LARGE).

## 11.3 Crime types & guidance (40)
- **Need:** the 40 `crime_types` (doc 03) with descriptions + response guidance.
- **Source:** met.police.uk "advice & information" / "report a crime" pages describe crime
  categories and what to do — usable to enrich `description` and `typical_response`.
- **Scraping note:** optional; the 40-row catalogue in doc 03 is sufficient to seed. If we scrape,
  it's a one-off build-time script writing a CSV, not a runtime dependency.

## 11.4 Officers (40,000)
- Fully synthetic: names from an open first/last-name corpus; `collar_number` generated;
  `rank` distribution (mostly PC, fewer PS/INSP, some detective ranks); `home_station` assigned by
  station capacity weighting; `default_mode` from fleet availability; skills sampled to hit the
  distribution in doc 06 (exactly 6,000 firearms).

## 11.5 Vehicles (~10,390)
- Generated per fleet totals (doc 06). Car regs synthesised in UK format (`LX21 ABC`); bikes /
  scooters / dog cars / horses get asset numbers (`MB-000123`). Home station assigned by station
  size.

## 11.6 Addresses
- Seeded lazily: the call simulator generates plausible street addresses within a chosen postcode
  (house number + street name from an open London street-name list + the postcode centroid,
  jittered a few metres). Mobile fixes generate a lat/long near the centroid with an
  `accuracy_m` radius (50–500 m).

## 11.7 OSRM routing data
- **Need:** a routing graph for Greater London.
- **Source:** Geofabrik **Greater London OSM extract** (`greater-london-latest.osm.pbf`, open).
- **Build:** `osrm-extract` + `osrm-partition` + `osrm-customize` for `car`, `bike`, `foot`
  profiles at image-build time; the `osrm` container serves routes. Pre-processing is the one
  heavy build step — cached as a volume.

## 11.8 Map tiles
- **OpenFreeMap** vector tiles (free, no API key) as default; **MapTiler** free tier or a
  self-hosted `tileserver-gl` with the London extract as alternatives for offline demos.

## 11.9 Seeding mechanics
- **Flyway** migrations create schema; a `seed-service` (or a Spring `CommandLineRunner` in
  `resource-service`, run once and guarded by a marker row) populates reference + master data.
- Seeding 40k officers + 280k shift rows/week is bulk-inserted (batched) — runs in seconds.
- Seed is **idempotent** (skips if already populated), matching the `payments` seed pattern.

## 11.10 Provenance & licensing
- ONS/ONSPD and OSM data are open-licensed (OGL / ODbL) — attribution retained in a
  `DATA_SOURCES.md` at build. met.police.uk content used only for realistic category text in a
  demo. All personal/officer data is synthetic.
