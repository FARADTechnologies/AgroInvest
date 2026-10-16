"""Factor catalogue: what is measured, in which criteria group, and where it will come from."""

from dataclasses import dataclass

GROUPS: dict[str, str] = {
    "SOIL": "Torpaq",
    "CLIMATE": "İqlim",
    "TERRAIN": "Relyef",
    "ACCESS": "Su və infrastruktur",
}


@dataclass(frozen=True)
class Factor:
    key: str
    label: str
    group: str
    unit: str
    decimals: int
    planned_source: str  # the real dataset that replaces the demo values


FACTORS: dict[str, Factor] = {
    f.key: f
    for f in (
        Factor("fertility", "Münbitlik indeksi", "SOIL", "/100", 0, "FAO GSSmap / SoilGrids"),
        Factor("soc", "Üzvi karbon", "SOIL", "%", 2, "SoilGrids 2.0 (SOC)"),
        Factor("nitrogen", "Ümumi azot", "SOIL", "%", 2, "SoilGrids 2.0 (nitrogen)"),
        Factor("ph", "Torpağın pH-ı", "SOIL", "", 1, "SoilGrids 2.0 (pH H₂O)"),
        Factor("texture", "Mexaniki tərkib", "SOIL", "", 0, "SoilGrids 2.0 (gil, lil, qum)"),
        Factor("salinity", "Şoranlıq (EC)", "SOIL", "dS/m", 1, "FAO Global Soil Salinity Map"),
        Factor("landcover", "Torpaq örtüyü", "SOIL", "", 0, "OpenStreetMap / EKTİS"),
        Factor("precip", "İllik yağıntı", "CLIMATE", "mm", 0, "WorldClim 2.1 (bio12)"),
        Factor("temp", "Orta illik temperatur", "CLIMATE", "°C", 1, "WorldClim 2.1 (bio1)"),
        Factor("frost_free", "Şaxtasız günlər", "CLIMATE", "gün", 0, "ERA5-Land / WorldClim"),
        Factor("ghi", "Günəş radiasiyası (GHI)", "CLIMATE", "kWh/m²/il", 0, "Global Solar Atlas"),
        Factor("elevation", "Hündürlük", "TERRAIN", "m", 0, "Copernicus DEM GLO-30"),
        Factor("slope", "Meyillik", "TERRAIN", "°", 1, "Copernicus DEM GLO-30"),
        Factor("aspect", "Yamacın istiqaməti", "TERRAIN", "°", 0, "Copernicus DEM GLO-30"),
        Factor("water", "Su mənbəyinə məsafə", "ACCESS", "km", 1, "OpenStreetMap"),
        Factor("road", "Əsas yola məsafə", "ACCESS", "km", 1, "OpenStreetMap"),
        Factor("settlement", "Yaşayış məntəqəsinə məsafə", "ACCESS", "km", 1, "OpenStreetMap"),
        Factor(
            "potable",
            "İçməli su mənbəyinə məsafə",
            "ACCESS",
            "km",
            1,
            "OSM (drinking_water, spring, water_well) / Azərsu şəbəkəsi",
        ),
    )
}

# Factors measured from real data today (OpenStreetMap in PostGIS); the rest are demo values.
MEASURED = {"water", "road", "settlement", "landcover"}

TEXTURE_LABEL = {
    "CLAY": "Gilli",
    "CLAY_LOAM": "Ağır gillicəli",
    "LOAM": "Orta gillicəli",
    "SANDY_LOAM": "Yüngül gillicəli",
    "STONY": "Çınqıllı (skeletli)",
}

SOURCE_LABEL = {
    "SYNTHETIC": "Nümayiş məlumatı (sintetik)",
    "OSM": "OpenStreetMap (ölçülüb)",
    "CSV": "Xarici məlumat faylı",
    "EKTIS": "EKTİS",
}
