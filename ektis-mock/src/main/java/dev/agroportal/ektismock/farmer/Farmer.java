package dev.agroportal.ektismock.farmer;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** A farmer as registered in EKTIS. All records in the mock are fictional. */
@Schema(description = "Farmer registered in EKTIS")
public record Farmer(
        @Schema(example = "EKTIS-F-104512") String farmerId,
        @Schema(allowableValues = {"INDIVIDUAL", "COMPANY"}) String type,
        @Schema(description = "Personal identification number, individuals only", example = "5KQ7M2D") String fin,
        @Schema(description = "Taxpayer identification number, companies only", example = "1905832207") String voen,
        @Schema(example = "Yaşıl Vadi Aqro MMC") String name,
        LocalDate registeredOn,
        @Schema(description = "ISO 3166-2 code of the rayon of registration", example = "AZ-AGC") String rayonIso,
        @Schema(description = "Land declared in EKTIS, hectares") BigDecimal declaredLandHa,
        @Schema(description = "Declared activities: CROP, LIVESTOCK, ORCHARD, OTHER") List<String> activities,
        @Schema(allowableValues = {"ACTIVE", "SUSPENDED"}) String status) {}
