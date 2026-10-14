package dev.agroportal.ektismock.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/ektis/v1")
@Tag(name = "health")
public class HealthController {

    @GetMapping("/health")
    @Operation(summary = "Liveness probe")
    public Map<String, String> health() {
        return Map.of("status", "ok", "system", "EKTIS (mock)");
    }
}
