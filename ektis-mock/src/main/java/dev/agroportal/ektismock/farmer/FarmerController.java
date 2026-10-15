package dev.agroportal.ektismock.farmer;

import dev.agroportal.ektismock.fault.FaultState;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/ektis/v1/farmers")
@Tag(name = "farmers", description = "Farmer registry lookup")
@SecurityRequirement(name = "apiKey")
public class FarmerController {

    private static final Pattern FIN = Pattern.compile("^[A-Z0-9]{7}$");
    private static final Pattern VOEN = Pattern.compile("^\\d{10}$");

    private final FarmerRegistry registry;
    private final FaultState faults;

    public FarmerController(FarmerRegistry registry, FaultState faults) {
        this.registry = registry;
        this.faults = faults;
    }

    @GetMapping
    @Operation(
            summary = "Find a farmer by FIN (individual) or VOEN (company)",
            description = "Exactly one of fin or voen must be given. The portal uses this to show "
                    + "whether an applicant is already registered as a farmer in EKTIS.")
    @ApiResponse(responseCode = "200", description = "Registered farmer")
    @ApiResponse(responseCode = "400", description = "Neither or both identifiers, or a malformed one")
    @ApiResponse(responseCode = "404", description = "Not registered in EKTIS")
    @ApiResponse(responseCode = "503", description = "EKTIS unavailable")
    public Farmer find(
            @Parameter(description = "FIN, 7 characters", example = "5KQ7M2D") @RequestParam(required = false) String fin,
            @Parameter(description = "VOEN, 10 digits", example = "1905832207") @RequestParam(required = false) String voen) {
        faults.apply();
        if ((fin == null) == (voen == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Give exactly one of fin or voen");
        }
        if (fin != null) {
            String normalized = fin.trim().toUpperCase();
            if (!FIN.matcher(normalized).matches()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "FIN must be 7 letters or digits");
            }
            return registry.byFin(normalized).orElseThrow(FarmerController::notFound);
        }
        String normalized = voen.trim();
        if (!VOEN.matcher(normalized).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "VOEN must be 10 digits");
        }
        return registry.byVoen(normalized).orElseThrow(FarmerController::notFound);
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "No farmer with this identifier in EKTIS");
    }
}
