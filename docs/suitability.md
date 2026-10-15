# Land suitability methodology

Decision support for the commission and applicants: how well a farm area suits each activity.
It never decides; the competition commission does. Method version `mcda-2`.

## Method in one paragraph

A GIS multi-criteria evaluation (GIS-MCDA). For each activity (Əkinçilik, Bağçılıq,
Heyvandarlıq, Digər) a set of factors is turned into memberships between 0 and 1, weighted with a
two-level AHP (criteria groups, then factors inside each group) and summed:
`score = 100 × Σ group weight × factor weight × membership`. FAO classes: S1 ≥ 75, S2 ≥ 50,
S3 ≥ 25, otherwise N. Hard constraints give N whatever the score.

## Factors

| Group | Factor | Unit | Source today | Planned source |
|---|---|---|---|---|
| Torpaq | Fertility index | /100 | synthetic | FAO GSSmap / SoilGrids |
| | Organic carbon | % | synthetic | SoilGrids 2.0 |
| | Total nitrogen | % | synthetic | SoilGrids 2.0 |
| | pH | | synthetic | SoilGrids 2.0 (pH H₂O) |
| | Texture class | | synthetic | SoilGrids 2.0 (clay, silt, sand) |
| | Salinity (EC) | dS/m | synthetic | FAO Global Soil Salinity Map |
| | Land cover | | OpenStreetMap | OSM / EKTİS |
| İqlim | Annual precipitation | mm | synthetic | WorldClim 2.1 (bio12) |
| | Mean annual temperature | °C | synthetic | WorldClim 2.1 (bio1) |
| | Frost-free days | days | synthetic | ERA5-Land / WorldClim |
| | Solar radiation (GHI) | kWh/m²/yr | synthetic | Global Solar Atlas |
| Relyef | Elevation, slope, aspect | m, ° | synthetic | Copernicus DEM GLO-30 |
| Su və infrastruktur | Distance to water, main road, settlement | km | OpenStreetMap, measured in PostGIS | — |
| | Distance to drinking water (≤ 0.3 km shown as on-site access) | km | synthetic | OSM `drinking_water`, `spring`, `water_well`; Azərsu network |

Each activity uses its own subset (e.g. orchards use aspect and frost-free days, livestock uses
organic carbon and drinking water). Every stored factor carries its source tag; the area page
marks synthetic values "nümayiş".

### Synthetic values

Deterministic and spatially coherent, so the same place always gets the same value and nearby
places get similar ones. Elevation is interpolated between known elevations of the region plus
smooth noise; climate follows lapse rates (−0.62 °C and +30 mm per 100 m); soils follow the
geography (Kür-Araz lowland alkaline and saline, mountain meadow soils rich in humus). Result:
Ağcabədi about 30 m, 280 mm, EC 6.8 dS/m; Kəlbəcər about 2,150 m, 960 mm, 110 frost-free days.

### Replacing them with real data

`api/app/modules/suitability/sources.py` reads each factor through an adapter. Sample a raster
into a CSV (rows keyed by area code, or by `lon,lat`) and set, for example:

```
SUITABILITY_SOURCES={"ph": {"adapter": "csv", "path": "/seed/factors/ph.csv", "column": "ph"}}
```

then re-score with `python -m app.modules.suitability`. No code change; missing rows fall back
to the synthetic value, still tagged as such.

## Membership functions

* decreasing (distances, slope, salinity): 1 up to a good value, 0 from a poor value, linear between
* increasing (fertility, frost-free days, radiation): the mirror image
* trapezoid (pH, temperature, rainfall, elevation): 1 on the optimal range, linear shoulders
* aspect: 1 facing south, 0 facing north, flat ground (< 2°) counts as 1
* categories (texture, land cover): a table per activity

The thresholds per activity are in `api/app/modules/suitability/model.py` (`RULES`) and are
published by `GET /api/v1/suitability/method`.

## AHP weights

Experts compare the four groups pairwise on Saaty's 1–9 scale, then the factors inside each
group. Weights are the principal eigenvector of each matrix; a matrix is accepted only if its
consistency ratio CR = CI / RI is below 0.1. Default group weights:

| Activity | Torpaq | İqlim | Relyef | Su və infrastruktur |
|---|---:|---:|---:|---:|
| Əkinçilik | 35% | 19% | 11% | 35% |
| Bağçılıq | 33% | 33% | 17% | 17% |
| Heyvandarlıq | 33% | 33% | 17% | 17% |
| Digər | 10% | 29% | 18% | 43% |

All default matrices have CR ≤ 0.05.

## Constraints

* not cleared of mines → N (demining status is demo data; ANAMA in the pilot)
* orchards on soil with EC > 6 dS/m → N

## Maintaining the method

Specialists and administrators edit the matrices at `/admin/suitability`. Weights and CR update
live; a matrix with CR ≥ 0.1 cannot be saved, and the server checks the same rules. Saving
publishes the next version (`mcda-2.1`, `mcda-2.2`, …), re-scores every area and writes an
audit entry with the justification and the number of FAO classes that changed. Earlier versions
stay in the history.

## Where it shows

* area page: score and class per activity, best-fit activity, "Niyə 78?" breakdown by group
  (value, membership, weight, contribution, source), and a "Metodologiya" section with the
  pairwise matrix, weights, CR, classes and data sources
* compare page: TOPSIS ranking uses the suitability score of the chosen activity
* API: `GET /api/v1/areas/{code}` (`suitability`), `GET /api/v1/suitability/method`
