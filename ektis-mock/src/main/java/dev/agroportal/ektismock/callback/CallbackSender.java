package dev.agroportal.ektismock.callback;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.agroportal.ektismock.config.EktisProperties;
import dev.agroportal.ektismock.decision.DecisionInbox;
import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Tells the portal, a moment after registration, that EKTIS has processed a decision.
 *
 * <p>Real registries often confirm asynchronously, so the portal must accept a signed callback.
 * Each event carries an id used as the {@code Idempotency-Key}; failed deliveries are retried a
 * few times with growing delays, and the portal ignores an event it has already seen.
 */
@Component
public class CallbackSender {

    private static final Logger log = LoggerFactory.getLogger(CallbackSender.class);
    private static final long[] DELAYS_SECONDS = {2, 5, 15, 30};

    private final EktisProperties properties;
    private final ObjectMapper mapper;
    // HTTP/1.1 on purpose: the default HTTP/2 upgrade attempt (h2c) is not understood by
    // every server and can lose the request body, which then fails the signature check.
    private final HttpClient http = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(3))
            .build();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread thread = new Thread(r, "ektis-callbacks");
        thread.setDaemon(true);
        return thread;
    });

    public CallbackSender(EktisProperties properties, ObjectMapper mapper) {
        this.properties = properties;
        this.mapper = mapper;
    }

    @PreDestroy
    void stop() {
        scheduler.shutdownNow();
    }

    /** Schedules the "registered" event for a newly received decision. */
    public void decisionRegistered(DecisionInbox.Entry entry) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventId", UUID.randomUUID().toString());
        event.put("type", "LAND_USE_DECISION_REGISTERED");
        event.put("decisionId", entry.receipt().decisionId().toString());
        event.put("ektisReference", entry.receipt().ektisReference());
        event.put("applicationNumber", entry.decision().applicationNumber());
        event.put("parcelCode", entry.decision().parcel().code());
        event.put("landUseRightId", entry.receipt().ektisReference().replace("LUD", "LUR"));
        event.put("registeredAt", Instant.now().toString());
        String requestId = entry.requestId() == null ? UUID.randomUUID().toString() : entry.requestId();
        schedule(event, requestId, 0);
    }

    private void schedule(Map<String, Object> event, String requestId, int attempt) {
        if (attempt >= DELAYS_SECONDS.length) {
            log.warn("callback {} given up after {} attempts", event.get("eventId"), attempt);
            return;
        }
        scheduler.schedule(() -> send(event, requestId, attempt), DELAYS_SECONDS[attempt], TimeUnit.SECONDS);
    }

    private void send(Map<String, Object> event, String requestId, int attempt) {
        try {
            String body = mapper.writeValueAsString(event);
            long timestamp = Instant.now().getEpochSecond();
            HttpRequest request = HttpRequest.newBuilder(URI.create(properties.portalWebhookUrl()))
                    .timeout(Duration.ofSeconds(5))
                    .header("Content-Type", "application/json")
                    .header("X-Request-ID", requestId)
                    .header("Idempotency-Key", event.get("eventId").toString())
                    .header("X-Timestamp", Long.toString(timestamp))
                    .header("X-Signature", Signer.sign(properties.hmacSecret(), timestamp, body))
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 == 2) {
                log.info("callback {} delivered ({})", event.get("eventId"), response.statusCode());
                return;
            }
            log.warn("callback {} answered {}", event.get("eventId"), response.statusCode());
        } catch (JsonProcessingException e) {
            log.error("callback {} could not be serialised", event.get("eventId"), e);
            return;
        } catch (Exception e) {  // network errors: retry
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            log.warn("callback {} failed: {}", event.get("eventId"), e.getMessage());
        }
        schedule(event, requestId, attempt + 1);
    }
}
