package dev.agroportal.ektismock;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.agroportal.ektismock.decision.DecisionInbox;
import dev.agroportal.ektismock.fault.FaultState;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest(properties = "ektis.api-key=test-key")
@AutoConfigureMockMvc
class EktisContractTest {

    private static final String KEY = "test-key";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private FaultState faults;

    @Autowired
    private DecisionInbox inbox;

    @BeforeEach
    void reset() {
        faults.set(FaultState.Fault.NONE);
        inbox.clear();
    }

    private static MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder request) {
        return request.header("X-API-Key", KEY);
    }

    private static String decision(UUID id) {
        return """
                {"decisionId": "%s",
                 "applicationNumber": "QIM-2026-000003",
                 "competitionNumber": "MS-2026-004",
                 "outcome": "WON",
                 "decidedAt": "2026-10-15T08:00:00Z",
                 "reason": "Ən yüksək qiymətləndirilmiş müraciət",
                 "leaseTermYears": 25,
                 "parcel": {"code": "XCI-0001", "areaHa": 284.65, "rayonIso": "AZ-XCI",
                            "purpose": "CROP", "centroid": [46.81, 39.93]},
                 "applicant": {"type": "COMPANY", "voen": "1403567821", "name": "Araz Aqro MMC",
                               "ektisFarmerId": "EKTIS-F-100873"}}
                """.formatted(id);
    }

    @Test
    void everyCallNeedsTheApiKey() throws Exception {
        mvc.perform(get("/ektis/v1/farmers").param("voen", "1905832207"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("unauthorized"));
        mvc.perform(get("/ektis/v1/farmers").param("voen", "1905832207").header("X-API-Key", "wrong"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/ektis/v1/health")).andExpect(status().isOk());
    }

    @Test
    void findsARegisteredCompanyByVoenAndEchoesTheRequestId() throws Exception {
        mvc.perform(authed(get("/ektis/v1/farmers").param("voen", "1905832207")).header("X-Request-ID", "req-123"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Request-ID", "req-123"))
                .andExpect(jsonPath("$.farmerId").value("EKTIS-F-104512"))
                .andExpect(jsonPath("$.name").value("Yaşıl Vadi Aqro MMC"))
                .andExpect(jsonPath("$.fin").doesNotExist());
    }

    @Test
    void findsAnIndividualByFinCaseInsensitively() throws Exception {
        mvc.perform(authed(get("/ektis/v1/farmers").param("fin", "5kq7m2d")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("INDIVIDUAL"));
    }

    @Test
    void unknownAndMalformedIdentifiers() throws Exception {
        mvc.perform(authed(get("/ektis/v1/farmers").param("voen", "2004119836")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("not_found"));
        mvc.perform(authed(get("/ektis/v1/farmers").param("voen", "123")))
                .andExpect(status().isBadRequest());
        mvc.perform(authed(get("/ektis/v1/farmers").param("voen", "1905832207").param("fin", "5KQ7M2D")))
                .andExpect(status().isBadRequest());
        mvc.perform(authed(get("/ektis/v1/farmers"))).andExpect(status().isBadRequest());
    }

    @Test
    void registersADecisionOnceAndRepeatsTheReceipt() throws Exception {
        UUID id = UUID.randomUUID();
        mvc.perform(authed(post("/ektis/v1/land-use-decisions"))
                        .contentType(MediaType.APPLICATION_JSON).content(decision(id)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("REGISTERED"))
                .andExpect(jsonPath("$.ektisReference", matchesPattern("EKTIS-LUD-\\d{4}-000001")));
        mvc.perform(authed(post("/ektis/v1/land-use-decisions"))
                        .contentType(MediaType.APPLICATION_JSON).content(decision(id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ektisReference", matchesPattern("EKTIS-LUD-\\d{4}-000001")));
        mvc.perform(authed(get("/ektis/v1/_mock/inbox")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].decision.parcel.code").value("XCI-0001"));
    }

    @Test
    void rejectsAnInvalidDecision() throws Exception {
        String body = decision(UUID.randomUUID()).replace("QIM-2026-000003", "QIM-1");
        mvc.perform(authed(post("/ektis/v1/land-use-decisions"))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("invalid_request"));
    }

    @Test
    void aSimulatedOutageFailsBusinessCallsUntilSwitchedOff() throws Exception {
        mvc.perform(authed(post("/ektis/v1/_mock/faults"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"mode\": \"DOWN\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mode").value("DOWN"));
        mvc.perform(authed(post("/ektis/v1/land-use-decisions"))
                        .contentType(MediaType.APPLICATION_JSON).content(decision(UUID.randomUUID())))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("service_unavailable"));
        mvc.perform(authed(get("/ektis/v1/farmers").param("voen", "1905832207")))
                .andExpect(status().isServiceUnavailable());
        mvc.perform(get("/ektis/v1/health")).andExpect(status().isOk());

        mvc.perform(authed(post("/ektis/v1/_mock/faults"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"mode\": \"NONE\"}"))
                .andExpect(status().isOk());
        mvc.perform(authed(post("/ektis/v1/land-use-decisions"))
                        .contentType(MediaType.APPLICATION_JSON).content(decision(UUID.randomUUID())))
                .andExpect(status().isCreated());
    }
}
