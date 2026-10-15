package dev.agroportal.ektismock.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Checks the portal's API key and carries the correlation id.
 *
 * <p>Every call except health and the API documentation needs {@code X-API-Key}. The
 * {@code X-Request-ID} sent by the portal is echoed back and logged, so one request can be
 * followed through the portal's integration log and this service's log.
 */
@Component
public class ApiKeyFilter extends OncePerRequestFilter {

    public static final String API_KEY = "X-API-Key";
    public static final String REQUEST_ID = "X-Request-ID";
    private static final Logger log = LoggerFactory.getLogger(ApiKeyFilter.class);

    private final byte[] expected;

    public ApiKeyFilter(EktisProperties properties) {
        this.expected = properties.apiKey().getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.startsWith("/ektis/v1/")
                || path.equals("/ektis/v1/health")
                || path.startsWith("/ektis/v1/api-docs");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String requestId = request.getHeader(REQUEST_ID);
        if (requestId == null || requestId.isBlank() || requestId.length() > 100) {
            requestId = UUID.randomUUID().toString();
        }
        response.setHeader(REQUEST_ID, requestId);
        MDC.put("requestId", requestId);
        try {
            String key = request.getHeader(API_KEY);
            boolean valid = key != null
                    && MessageDigest.isEqual(expected, key.getBytes(StandardCharsets.UTF_8));
            if (!valid) {
                log.warn("rejected {} {} without a valid API key", request.getMethod(), request.getRequestURI());
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
                response.getWriter().write(
                        "{\"status\":401,\"code\":\"unauthorized\",\"detail\":\"Missing or invalid X-API-Key\"}");
                return;
            }
            log.info("{} {} request_id={}", request.getMethod(), request.getRequestURI(), requestId);
            chain.doFilter(request, response);
        } finally {
            MDC.remove("requestId");
        }
    }
}
