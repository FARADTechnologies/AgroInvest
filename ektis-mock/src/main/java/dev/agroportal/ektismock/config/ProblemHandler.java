package dev.agroportal.ektismock.config;

import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

/** Errors as RFC 9457 problem details with a stable {@code code}, like the portal API. */
@RestControllerAdvice
public class ProblemHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ProblemDetail status(ResponseStatusException e) {
        return problem(e.getStatusCode(), codeFor(e.getStatusCode()), e.getReason());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail invalid(MethodArgumentNotValidException e) {
        String detail = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .sorted()
                .collect(Collectors.joining("; "));
        return problem(HttpStatus.BAD_REQUEST, "invalid_request", detail);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ProblemDetail unreadable(HttpMessageNotReadableException e) {
        return problem(HttpStatus.BAD_REQUEST, "invalid_request", "Request body is not valid JSON for this operation");
    }

    private static String codeFor(HttpStatusCode status) {
        return switch (status.value()) {
            case 400 -> "invalid_request";
            case 404 -> "not_found";
            case 503 -> "service_unavailable";
            default -> "error";
        };
    }

    private static ProblemDetail problem(HttpStatusCode status, String code, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setProperty("code", code);
        return problem;
    }
}
