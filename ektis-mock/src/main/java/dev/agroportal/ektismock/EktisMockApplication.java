package dev.agroportal.ektismock;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Test double of the EKTIS (Electronic Agriculture Information System) REST interface.
 *
 * <p>The real system is never contacted. This service implements the contract the portal
 * expects, so the integration can be demonstrated end to end and replaced by the real
 * endpoint once the authority grants access.
 */
@SpringBootApplication
@OpenAPIDefinition(info = @Info(
        title = "EKTIS mock API",
        version = "v1",
        description = "Simulated EKTIS interface: farmer registry lookup, land-use decisions, fault injection."))
public class EktisMockApplication {

    public static void main(String[] args) {
        SpringApplication.run(EktisMockApplication.class, args);
    }
}
