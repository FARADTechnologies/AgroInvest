package dev.agroportal.ektismock.fault;

import dev.agroportal.ektismock.decision.DecisionInbox;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Controls that exist only in the mock: fault injection and a view of what EKTIS received. */
@RestController
@RequestMapping("/ektis/v1/_mock")
@Tag(name = "mock controls", description = "Not part of the EKTIS contract; demo and test only")
@SecurityRequirement(name = "apiKey")
public class MockControlController {

    @Schema(description = "Fault to simulate")
    public record FaultRequest(
            @NotNull FaultState.Mode mode,
            @Min(0) @Max(30000) Integer delayMs,
            @DecimalMin("0") @DecimalMax("1") Double errorRate) {}

    private final FaultState faults;
    private final DecisionInbox inbox;

    public MockControlController(FaultState faults, DecisionInbox inbox) {
        this.faults = faults;
        this.inbox = inbox;
    }

    @GetMapping("/faults")
    @Operation(summary = "Current simulated fault")
    public FaultState.Fault fault() {
        return faults.get();
    }

    @PostMapping("/faults")
    @Operation(summary = "Simulate a fault: NONE, DOWN (503), SLOW (delay) or ERROR_RATE (random 500s)")
    public FaultState.Fault setFault(@Valid @RequestBody FaultRequest request) {
        int delay = request.delayMs() == null ? 3000 : request.delayMs();
        double rate = request.errorRate() == null ? 0.5 : request.errorRate();
        return faults.set(new FaultState.Fault(request.mode(), delay, rate));
    }

    @GetMapping("/inbox")
    @Operation(summary = "Decisions received so far, newest first")
    public List<DecisionInbox.Entry> inbox() {
        return inbox.list();
    }

    @DeleteMapping("/inbox")
    @Operation(summary = "Empty the inbox (demo reset)")
    public ResponseEntity<Void> clearInbox() {
        inbox.clear();
        return ResponseEntity.noContent().build();
    }
}
