package dev.agroportal.ektismock.decision;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A competition decision the portal reports to EKTIS: who received the right to use which
 * farm area, on what terms. The portal's decision id doubles as the idempotency key.
 */
@Schema(description = "Land-use decision sent by the investment competition portal")
public record LandUseDecision(
        @NotNull @Schema(description = "Portal decision id; resending the same id is safe") UUID decisionId,
        @NotBlank @Pattern(regexp = "^QIM-\\d{4}-\\d{6}$") @Schema(example = "QIM-2026-000003") String applicationNumber,
        @NotBlank @Pattern(regexp = "^MS-\\d{4}-\\d{3}$") @Schema(example = "MS-2026-004") String competitionNumber,
        @NotNull @Pattern(regexp = "^(WON|REJECTED)$") @Schema(allowableValues = {"WON", "REJECTED"}) String outcome,
        @NotNull Instant decidedAt,
        @Size(max = 2000) String reason,
        @NotNull @Valid Parcel parcel,
        @NotNull @Valid Applicant applicant,
        @Schema(description = "Lease term granted, years") Integer leaseTermYears) {

    @Schema(description = "The farm area the decision is about")
    public record Parcel(
            @NotBlank @Schema(example = "XCI-0001") String code,
            @NotNull @DecimalMin("0.1") BigDecimal areaHa,
            @NotBlank @Pattern(regexp = "^AZ-[A-Z]{2,3}$") @Schema(example = "AZ-XCI") String rayonIso,
            @NotBlank @Pattern(regexp = "^(CROP|LIVESTOCK|ORCHARD|OTHER)$") String purpose,
            @Size(min = 2, max = 2) @Schema(description = "[lon, lat]") List<Double> centroid) {}

    @Schema(description = "The entrepreneur; FIN for individuals, VOEN for companies")
    public record Applicant(
            @NotBlank @Pattern(regexp = "^(INDIVIDUAL|COMPANY)$") String type,
            @Pattern(regexp = "^[A-Z0-9]{7}$") String fin,
            @Pattern(regexp = "^\\d{10}$") String voen,
            @NotBlank @Size(max = 300) String name,
            @Schema(description = "EKTIS farmer id when the portal found one", example = "EKTIS-F-104512")
            String ektisFarmerId) {}
}
