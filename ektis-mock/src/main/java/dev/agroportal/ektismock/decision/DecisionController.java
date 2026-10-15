package dev.agroportal.ektismock.decision;

import dev.agroportal.ektismock.config.ApiKeyFilter;
import dev.agroportal.ektismock.fault.FaultState;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/ektis/v1/land-use-decisions")
@Tag(name = "land-use decisions", description = "Competition results reported by the portal")
@SecurityRequirement(name = "apiKey")
public class DecisionController {

    private static final Logger log = LoggerFactory.getLogger(DecisionController.class);

    private final DecisionInbox inbox;
    private final FaultState faults;

    public DecisionController(DecisionInbox inbox, FaultState faults) {
        this.inbox = inbox;
        this.faults = faults;
    }

    @PostMapping
    @Operation(
            summary = "Register a land-use decision",
            description = "Idempotent on decisionId: resending a decision returns the original receipt "
                    + "with 200 instead of 201, so the portal can retry safely after a timeout.")
    @ApiResponse(responseCode = "201", description = "Registered")
    @ApiResponse(responseCode = "200", description = "Already registered earlier; same receipt")
    @ApiResponse(responseCode = "400", description = "Invalid decision")
    @ApiResponse(responseCode = "503", description = "EKTIS unavailable; retry later")
    public ResponseEntity<DecisionInbox.Receipt> register(
            @Valid @RequestBody LandUseDecision decision, HttpServletResponse response) {
        faults.apply();
        String requestId = response.getHeader(ApiKeyFilter.REQUEST_ID);
        DecisionInbox.Registration result = inbox.register(decision, requestId);
        DecisionInbox.Receipt receipt = result.entry().receipt();
        log.info("decision {} for {} -> {} ({})", decision.decisionId(), decision.applicationNumber(),
                receipt.ektisReference(), result.created() ? "new" : "repeat");
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(receipt);
    }
}
