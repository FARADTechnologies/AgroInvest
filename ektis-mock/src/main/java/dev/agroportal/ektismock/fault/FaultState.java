package dev.agroportal.ektismock.fault;

import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Fault injection, so the demo can show how the portal survives an EKTIS outage.
 *
 * <p>Business endpoints call {@link #apply()} first. Health and the mock control endpoints
 * never fail, so the fault can always be switched off again.
 */
@Component
public class FaultState {

    public enum Mode { NONE, DOWN, SLOW, ERROR_RATE }

    /** Current fault; {@code delayMs} applies to SLOW, {@code errorRate} (0–1) to ERROR_RATE. */
    public record Fault(Mode mode, int delayMs, double errorRate) {
        public static final Fault NONE = new Fault(Mode.NONE, 0, 0);
    }

    private final AtomicReference<Fault> current = new AtomicReference<>(Fault.NONE);

    public Fault get() {
        return current.get();
    }

    public Fault set(Fault fault) {
        current.set(fault);
        return fault;
    }

    public void apply() {
        Fault fault = current.get();
        switch (fault.mode()) {
            case DOWN -> throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "EKTIS is temporarily unavailable (simulated outage)");
            case SLOW -> sleep(fault.delayMs());
            case ERROR_RATE -> {
                if (ThreadLocalRandom.current().nextDouble() < fault.errorRate()) {
                    throw new ResponseStatusException(
                            HttpStatus.INTERNAL_SERVER_ERROR, "EKTIS failed to process the request (simulated)");
                }
            }
            case NONE -> { }
        }
    }

    private static void sleep(int millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
