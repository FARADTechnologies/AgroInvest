package dev.agroportal.ektismock.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Settings shared with the portal through the environment (see docker-compose.yml). */
@ConfigurationProperties(prefix = "ektis")
public record EktisProperties(String apiKey, String hmacSecret, String portalWebhookUrl) {}
