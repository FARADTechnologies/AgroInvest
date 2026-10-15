package dev.agroportal.ektismock;

import dev.agroportal.ektismock.config.EktisProperties;
import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeIn;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/**
 * Test double of the EKTIS (Electronic Agriculture Information System) REST interface.
 *
 * <p>The real system is never contacted. This service implements the contract the portal
 * expects, so the integration can be demonstrated end to end and replaced by the real
 * endpoint once the authority grants access.
 */
@SpringBootApplication
@EnableConfigurationProperties(EktisProperties.class)
@OpenAPIDefinition(info = @Info(
        title = "EKTIS mock API",
        version = "v1",
        description = "Simulated EKTIS interface: farmer registry lookup, land-use decisions, fault injection. "
                + "All records are fictional; the real EKTIS is never contacted."))
@SecurityScheme(
        name = "apiKey",
        type = SecuritySchemeType.APIKEY,
        in = SecuritySchemeIn.HEADER,
        paramName = "X-API-Key",
        description = "Key issued to the portal; in production the exchange runs over EHIS")
public class EktisMockApplication {

    public static void main(String[] args) {
        SpringApplication.run(EktisMockApplication.class, args);
    }
}
