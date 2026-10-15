package dev.agroportal.ektismock.decision;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.Year;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** In-memory store of received decisions; a real EKTIS would persist them in its registry. */
@Component
public class DecisionInbox {

    @Schema(description = "EKTIS acknowledgement of a land-use decision")
    public record Receipt(
            UUID decisionId,
            @Schema(example = "EKTIS-LUD-2026-000001") String ektisReference,
            @Schema(allowableValues = {"REGISTERED"}) String status,
            Instant receivedAt) {}

    @Schema(description = "A received decision with its receipt, for the mock inbox")
    public record Entry(Receipt receipt, String requestId, LandUseDecision decision) {}

    /** Result of {@link #register}: whether this call created the entry. */
    public record Registration(Entry entry, boolean created) {}

    private final Map<UUID, Entry> entries = new LinkedHashMap<>();
    private int sequence;

    public synchronized Registration register(LandUseDecision decision, String requestId) {
        Entry existing = entries.get(decision.decisionId());
        if (existing != null) {
            return new Registration(existing, false);
        }
        sequence++;
        String reference = "EKTIS-LUD-%d-%06d".formatted(Year.now().getValue(), sequence);
        Receipt receipt = new Receipt(decision.decisionId(), reference, "REGISTERED", Instant.now());
        Entry entry = new Entry(receipt, requestId, decision);
        entries.put(decision.decisionId(), entry);
        return new Registration(entry, true);
    }

    /** Newest first. */
    public synchronized List<Entry> list() {
        List<Entry> all = new ArrayList<>(entries.values());
        java.util.Collections.reverse(all);
        return all;
    }

    public synchronized void clear() {
        entries.clear();
    }
}
