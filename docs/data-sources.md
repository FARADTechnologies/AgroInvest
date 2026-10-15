# Where the farm-area data comes from

The 61 farm areas in the demo come from one place: **OpenStreetMap**, read offline from the
Geofabrik extract of Azerbaijan. Nothing is fetched at run time and no government system is
called. 46 areas are real polygons drawn by OpenStreetMap contributors; 15 are generated near
real villages where OpenStreetMap has no farmland mapped (mostly the mountain rayons).

## Source

| | |
|---|---|
| Dataset | OpenStreetMap, Azerbaijan extract `azerbaijan-latest.osm.pbf` (46.5 MB) |
| Provider | Geofabrik GmbH download server, updated daily: https://download.geofabrik.de/asia/azerbaijan.html |
| Downloaded | 14 Oct 2026 (the map shows the OSM state of that day) |
| Licence | Open Database License (ODbL) 1.0, © OpenStreetMap contributors; attribution is on the map |
| Access | plain HTTPS download, no account or API key |
| Our pipeline | `geo/build_base.py` (areas, rayons, villages, outline, sea) and `geo/build_layers.py` (roads, water); outputs committed in `seed/geo/*.geojson`, loaded by the API seed |

## How each field is obtained

| Field | Real? | How |
|---|---|---|
| Polygon and coordinates | real for 46 (`data_source = OSM`) | OSM ways tagged `landuse=farmland`, `orchard`, `vineyard` or `meadow` inside the 14 rayons, 5–300 ha (the Rules' minimum contour is 5 ha) |
| | generated for 15 (`data_source = SYNTHETIC`) | field-shaped polygons 0.6–2.5 km from a real village, inside the rayon, not overlapping other plots |
| Area (ha) | computed | polygon area in WGS 84 / UTM 38N (EPSG:32638) |
| Purpose (təyinat) | derived | `farmland` → Əkinçilik, `orchard`/`vineyard` → Bağçılıq, `meadow` → Heyvandarlıq. This is the land use OSM contributors observed, **not** the legal designation from the land cadastre |
| Rayon | real | OSM administrative boundaries matched on ISO 3166-2 codes (`AZ-AGM`, `AZ-FUZ`, …) |
| Nearest village and distance | real | OSM `place=city/town/village/hamlet` with an Azerbaijani name (`name:az`), nearest within 8 km |
| Distance to water and roads | computed | PostGIS distance to OSM `waterway=river/canal/stream`, `natural=water` and main roads (`highway=motorway … tertiary`) |
| Name, lease term, fee, irrigation, soil name, demining status, conditions, competitions | illustrative | written for the demo; labelled as such in the UI |
| Soil, climate and terrain factors in the suitability score | synthetic | deterministic demo values, tagged "nümayiş"; see `docs/suitability.md` |

## Checking a plot yourself

Every OSM-sourced plot keeps its OpenStreetMap way ID (the table below links to it). Ways and
their geometry can be read without a key:

* in a browser: `https://www.openstreetmap.org/way/<id>`
* OSM API v0.6, one element with its nodes: `https://api.openstreetmap.org/api/0.6/way/<id>/full`
  (append `.json` for JSON; meant for single lookups, not bulk download)
* Overpass API, all farmland of a rayon at once (the same query our pipeline reproduces offline):

```
[out:json][timeout:90];
area["ISO3166-2"="AZ-AGM"]->.rayon;
way["landuse"~"^(farmland|orchard|vineyard|meadow)$"](area.rayon);
out geom;
```

  sent as `POST https://overpass-api.de/api/interpreter` with `data=<query>`.

The OSM data can be newer than our extract: a contributor may have edited a way since 14 Oct 2026.

## Official sources for the pilot

These hold the authoritative data but publish no open API (see the research notes on EKTİS):

| Data | Holder | Status |
|---|---|---|
| Parcels (contours), land cadastre, designation | Ministry of Economy (identifies the land and prepares land-arrangement projects, Rules §1, Decree 236); land cadastre and orthophotos are kept in EKTİS | no public API; integration through EHİS by agreement |
| Competitions, applicants, farmer registry | Ministry of Agriculture, EKTİS (subsystem "kənd təsərrüfatı təyinatlı torpaqların istifadəsi") | no public API; our `ektis-mock` stands in for it |
| Demining status and certificates | ANAMA | no public API |

## The 61 plots

| Code | Source | OSM way | OSM tag → purpose | Area (ha) | Nearest village | Lat, lon |
|---|---|---|---|---:|---|---|
| AGC-0001 | OSM | [798530452](https://www.openstreetmap.org/way/798530452) | `landuse=orchard / vineyard` → ORCHARD | 10.91 | Aşağı Avşar | 40.05243, 47.42753 |
| AGC-0002 | OSM | [761574293](https://www.openstreetmap.org/way/761574293) | `landuse=farmland` → CROP | 7.05 | Sarjalı | 40.13648, 47.19684 |
| AGC-0003 | OSM | [221857064](https://www.openstreetmap.org/way/221857064) | `landuse=farmland` → CROP | 6.7 | Boyat | 40.03946, 47.12340 |
| AGM-0001 | OSM | [181293358](https://www.openstreetmap.org/way/181293358) | `landuse=farmland` → CROP | 270.24 | Mahızlı | 40.03027, 47.04478 |
| AGM-0002 | OSM | [301141387](https://www.openstreetmap.org/way/301141387) | `landuse=farmland` → CROP | 61.57 | Gülablı | 39.91672, 46.95500 |
| AGM-0003 | OSM | [185881931](https://www.openstreetmap.org/way/185881931) | `landuse=farmland` → CROP | 35.37 | İkinci Baharlı | 40.08737, 47.08325 |
| AGM-0004 | OSM | [265059823](https://www.openstreetmap.org/way/265059823) | `landuse=farmland` → CROP | 16.91 | Xıdırlı | 39.99362, 46.86361 |
| AGM-0005 | OSM | [173185363](https://www.openstreetmap.org/way/173185363) | `landuse=farmland` → CROP | 10.28 | Şükürağalı | 40.08043, 47.02438 |
| AGM-0006 | OSM | [1031730539](https://www.openstreetmap.org/way/1031730539) | `landuse=orchard / vineyard` → ORCHARD | 8.98 | Ağdam | 40.00696, 46.94809 |
| AGM-0007 | OSM | [265059824](https://www.openstreetmap.org/way/265059824) | `landuse=farmland` → CROP | 5.61 | Daşbaşı | 39.99517, 46.85395 |
| BAR-0001 | OSM | [762880844](https://www.openstreetmap.org/way/762880844) | `landuse=farmland` → CROP | 15.22 | İkinci Nazirli | 40.42636, 47.04446 |
| BAR-0002 | OSM | [1017361200](https://www.openstreetmap.org/way/1017361200) | `landuse=orchard / vineyard` → ORCHARD | 6.31 | Otuzikilər | 40.37871, 47.25157 |
| BAR-0003 | OSM | [1037407630](https://www.openstreetmap.org/way/1037407630) | `landuse=orchard / vineyard` → ORCHARD | 5.39 | Hacıbəyli | 40.39001, 47.17620 |
| CAB-0001 | SYNTHETIC | — | generated → CROP | 62.81 | Daşkəsən | 39.42582, 47.11302 |
| CAB-0002 | SYNTHETIC | — | generated → CROP | 52.77 | Horovlu | 39.41507, 47.09719 |
| CAB-0003 | SYNTHETIC | — | generated → ORCHARD | 35.17 | Daşkəsən | 39.42390, 47.09211 |
| CAB-0004 | OSM | [834186359](https://www.openstreetmap.org/way/834186359) | `landuse=farmland` → CROP | 8.0 | Cocuq Mərcanlı | 39.38955, 47.30401 |
| CAB-0005 | OSM | [775969262](https://www.openstreetmap.org/way/775969262) | `landuse=orchard / vineyard` → ORCHARD | 5.09 | Cəbrayıl | 39.36094, 47.03093 |
| FUZ-0001 | OSM | [834186685](https://www.openstreetmap.org/way/834186685) | `landuse=farmland` → CROP | 270.13 | Qazaxlar | 39.41007, 47.31334 |
| FUZ-0002 | OSM | [759288154](https://www.openstreetmap.org/way/759288154) | `landuse=farmland` → CROP | 14.57 | Qarabağ | 39.60012, 47.52635 |
| FUZ-0003 | OSM | [759288175](https://www.openstreetmap.org/way/759288175) | `landuse=farmland` → CROP | 10.27 | Araz Zərgər | 39.59296, 47.60799 |
| FUZ-0004 | OSM | [759288167](https://www.openstreetmap.org/way/759288167) | `landuse=farmland` → CROP | 8.58 | Əhmədbəyli | 39.58104, 47.57251 |
| FUZ-0005 | OSM | [913588208](https://www.openstreetmap.org/way/913588208) | `landuse=orchard / vineyard` → ORCHARD | 6.9 | Füzuli | 39.61514, 47.12828 |
| FUZ-0006 | OSM | [759288171](https://www.openstreetmap.org/way/759288171) | `landuse=farmland` → CROP | 5.11 | Araz Zərgər | 39.58380, 47.59821 |
| KAL-0001 | SYNTHETIC | — | generated → LIVESTOCK | 150.96 | Kəndyeri | 40.17226, 46.08958 |
| KAL-0002 | SYNTHETIC | — | generated → LIVESTOCK | 110.92 | Bozlu | 40.26349, 46.13994 |
| KAL-0003 | SYNTHETIC | — | generated → LIVESTOCK | 107.72 | Kəlbəcər | 40.12298, 46.04730 |
| KAL-0004 | SYNTHETIC | — | generated → LIVESTOCK | 62.17 | Ağqaya | 40.09840, 46.34618 |
| LAC-0001 | SYNTHETIC | — | generated → LIVESTOCK | 158.94 | Aşağı Sus | 39.63310, 46.52587 |
| LAC-0002 | SYNTHETIC | — | generated → LIVESTOCK | 123.08 | Hacıxanlı | 39.84729, 46.26486 |
| LAC-0003 | SYNTHETIC | — | generated → LIVESTOCK | 55.16 | Təzəkənd | 39.75342, 46.48698 |
| LAC-0004 | OSM | [415373693](https://www.openstreetmap.org/way/415373693) | `landuse=farmland` → CROP | 21.39 | Güləbird | 39.46479, 46.58469 |
| QBI-0001 | OSM | [867132122](https://www.openstreetmap.org/way/867132122) | `landuse=farmland` → CROP | 86.95 | Qarakişilər | 39.44041, 46.65731 |
| QBI-0002 | SYNTHETIC | — | generated → ORCHARD | 26.82 | Göyər Abbas | 39.39637, 46.46165 |
| QBI-0003 | OSM | [1323207044](https://www.openstreetmap.org/way/1323207044) | `landuse=farmland` → CROP | 11.44 | Muğanlı | 39.24440, 46.74433 |
| QBI-0004 | OSM | [867132119](https://www.openstreetmap.org/way/867132119) | `landuse=farmland` → CROP | 6.93 | Qarakişilər | 39.44513, 46.66977 |
| SUS-0001 | SYNTHETIC | — | generated → LIVESTOCK | 118.7 | Həsənqulular | 39.74877, 46.60367 |
| SUS-0002 | SYNTHETIC | — | generated → ORCHARD | 20.4 | Şırlan | 39.78162, 46.61175 |
| TAR-0001 | OSM | [230744463](https://www.openstreetmap.org/way/230744463) | `landuse=farmland` → CROP | 47.64 | Təzəkənd | 40.22417, 47.07158 |
| TAR-0002 | OSM | [1037486708](https://www.openstreetmap.org/way/1037486708) | `landuse=orchard / vineyard` → ORCHARD | 6.56 | Təzəkənd | 40.19748, 47.04546 |
| TAR-0003 | OSM | [222917936](https://www.openstreetmap.org/way/222917936) | `landuse=farmland` → CROP | 5.03 | Hüsənli | 40.20654, 47.09213 |
| XAN-0001 | SYNTHETIC | — | generated → OTHER | 7.01 | Xankəndi | 39.81515, 46.73875 |
| XCI-0001 | OSM | [1323023152](https://www.openstreetmap.org/way/1323023152) | `landuse=farmland` → CROP | 284.65 | Həsənabad | 39.89071, 46.76362 |
| XCI-0002 | OSM | [180610955](https://www.openstreetmap.org/way/180610955) | `landuse=farmland` → CROP | 14.45 | Daşbaşı | 39.98269, 46.83924 |
| XCI-0003 | OSM | [1317170389](https://www.openstreetmap.org/way/1317170389) | `landuse=orchard / vineyard` → ORCHARD | 7.72 | Əsgəran | 39.94091, 46.85820 |
| XCI-0004 | OSM | [690232503](https://www.openstreetmap.org/way/690232503) | `landuse=farmland` → CROP | 7.44 | Daşbulaq | 39.92090, 46.70937 |
| XCI-0005 | OSM | [865169729](https://www.openstreetmap.org/way/865169729) | `landuse=meadow` → LIVESTOCK | 6.33 | Şuşakənd | 39.76050, 46.79710 |
| XCI-0006 | OSM | [779545829](https://www.openstreetmap.org/way/779545829) | `landuse=orchard / vineyard` → ORCHARD | 5.22 | Həsənabad | 39.88268, 46.78814 |
| XVD-0001 | OSM | [1375101643](https://www.openstreetmap.org/way/1375101643) | `landuse=farmland` → CROP | 144.86 | Cütcü | 39.67962, 47.00306 |
| XVD-0002 | OSM | [864445719](https://www.openstreetmap.org/way/864445719) | `landuse=orchard / vineyard` → ORCHARD | 29.2 | Xocavənd | 39.78094, 47.10395 |
| XVD-0003 | OSM | [363384212](https://www.openstreetmap.org/way/363384212) | `landuse=farmland` → CROP | 21.19 | Şexer | 39.64697, 46.98725 |
| XVD-0004 | OSM | [301354918](https://www.openstreetmap.org/way/301354918) | `landuse=farmland` → CROP | 18.08 | Gülablı | 39.90674, 46.99690 |
| XVD-0005 | OSM | [870550947](https://www.openstreetmap.org/way/870550947) | `landuse=orchard / vineyard` → ORCHARD | 8.59 | Sos | 39.71891, 47.00356 |
| XVD-0006 | OSM | [842234548](https://www.openstreetmap.org/way/842234548) | `landuse=orchard / vineyard` → ORCHARD | 5.06 | Qarqar | 39.70403, 46.97580 |
| ZAN-0001 | OSM | [861025546](https://www.openstreetmap.org/way/861025546) | `landuse=farmland` → CROP | 234.62 | Malatkeşin | 39.11405, 46.68511 |
| ZAN-0002 | OSM | [861214022](https://www.openstreetmap.org/way/861214022) | `landuse=farmland` → CROP | 31.79 | Üdgün | 39.04453, 46.69262 |
| ZAN-0003 | OSM | [1323210200](https://www.openstreetmap.org/way/1323210200) | `landuse=farmland` → CROP | 13.9 | Xumarlı | 39.14517, 46.78020 |
| ZAN-0004 | OSM | [621573022](https://www.openstreetmap.org/way/621573022) | `landuse=farmland` → CROP | 10.2 | Qaragöz | 39.01482, 46.65567 |
| ZAN-0005 | OSM | [861025527](https://www.openstreetmap.org/way/861025527) | `landuse=farmland` → CROP | 10.09 | Sarılı | 39.14451, 46.75141 |
| ZAN-0006 | OSM | [861025537](https://www.openstreetmap.org/way/861025537) | `landuse=farmland` → CROP | 5.18 | İkinci Alıbəyli | 39.13644, 46.74108 |
| ZAN-0007 | SYNTHETIC | — | generated → OTHER | 3.05 | Qıraq Müşlan | 39.06543, 46.66264 |
