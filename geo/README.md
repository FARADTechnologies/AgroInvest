# Geo pipeline

Offline pipeline that turns OpenStreetMap data into the farm areas, rayon boundaries and
suitability scores loaded by the API seed. It runs on a developer machine, not in the stack;
its outputs are committed under `seed/` so the demo never needs the internet.
