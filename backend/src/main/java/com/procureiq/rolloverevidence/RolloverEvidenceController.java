package com.procureiq.rolloverevidence;

import jakarta.validation.Valid;
import org.springframework.dao.DataAccessException;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.sql.SQLException;
import java.util.Map;
import java.util.UUID;

import static com.procureiq.rolloverevidence.RolloverEvidenceRequests.*;

@RestController
@RequestMapping(
    value="/api/v1/flywheel-rollover-outcomes",
    produces=MediaType.APPLICATION_JSON_VALUE
)
@PreAuthorize(
    "hasAnyRole('APPROVER','BUYER','PROCUREMENT_MANAGER','ADMIN')"
)
public class RolloverEvidenceController {
    private final RolloverEvidenceService service;

    public RolloverEvidenceController(RolloverEvidenceService service) {
        this.service = service;
    }

    private UUID actor(JwtAuthenticationToken authentication) {
        try {
            return UUID.fromString(authentication.getToken().getSubject());
        } catch (RuntimeException error) {
            throw new ResponseStatusException(
                HttpStatus.UNAUTHORIZED,
                "Invalid authenticated subject."
            );
        }
    }

    private ResponseEntity<String> json(String document) {
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_JSON)
            .body(document);
    }

    @GetMapping("/dashboard")
    public ResponseEntity<String> dashboard(JwtAuthenticationToken auth) {
        return json(service.dashboard(actor(auth)));
    }

    @GetMapping("/cycles/{id}")
    public ResponseEntity<String> detail(
        JwtAuthenticationToken auth,
        @PathVariable UUID id
    ) {
        return json(service.detail(id,actor(auth)));
    }

    @GetMapping("/snapshots/{id}")
    public ResponseEntity<String> snapshot(
        JwtAuthenticationToken auth,
        @PathVariable UUID id
    ) {
        return json(service.snapshot(id,actor(auth)));
    }

    @PostMapping("/cycles")
    @PreAuthorize("hasAnyRole('BUYER','PROCUREMENT_MANAGER','ADMIN')")
    public ResponseEntity<String> open(
        JwtAuthenticationToken auth,
        @Valid @RequestBody Open input
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .contentType(MediaType.APPLICATION_JSON)
            .body(service.open(actor(auth),input));
    }

    @PostMapping("/cycles/{id}/plans")
    @PreAuthorize("hasAnyRole('BUYER','PROCUREMENT_MANAGER','ADMIN')")
    public ResponseEntity<String> plan(
        JwtAuthenticationToken auth,
        @PathVariable UUID id,
        @Valid @RequestBody Plan input
    ) {
        return json(service.plan(id,actor(auth),input));
    }

    @PostMapping("/cycles/{id}/observations")
    @PreAuthorize("hasAnyRole('BUYER','PROCUREMENT_MANAGER','ADMIN')")
    public ResponseEntity<String> observe(
        JwtAuthenticationToken auth,
        @PathVariable UUID id,
        @Valid @RequestBody Observation input
    ) {
        return json(service.observe(id,actor(auth),input));
    }

    @PostMapping("/cycles/{id}/transition")
    @PreAuthorize("hasAnyRole('BUYER','PROCUREMENT_MANAGER','ADMIN')")
    public ResponseEntity<String> transition(
        JwtAuthenticationToken auth,
        @PathVariable UUID id,
        @Valid @RequestBody Transition input
    ) {
        // Manager-only transitions are also checked against the active
        // database role in the same transaction as the state mutation.
        return json(service.transition(id,actor(auth),input));
    }

    @PostMapping("/cycles/{id}/snapshots")
    @PreAuthorize("hasAnyRole('BUYER','PROCUREMENT_MANAGER','ADMIN')")
    public ResponseEntity<String> capture(
        JwtAuthenticationToken auth,
        @PathVariable UUID id
    ) {
        return json(service.capture(id,actor(auth)));
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String,String>> databaseError(
        DataAccessException error
    ) {
        String state="";

        for (Throwable cause=error;cause!=null;cause=cause.getCause()) {
            if (cause instanceof SQLException sql) {
                state=sql.getSQLState();
                break;
            }
        }

        HttpStatus status;
        String message;

        if ("42501".equals(state)) {
            status=HttpStatus.FORBIDDEN;
            message="Your active role cannot perform this operation.";
        } else if ("P0002".equals(state)) {
            status=HttpStatus.NOT_FOUND;
            message="The requested source, cycle, or snapshot was not found.";
        } else if ("23505".equals(state)) {
            status=HttpStatus.CONFLICT;
            message="This source, item, or next cycle has already been recorded. Reload the page.";
        } else if ("55000".equals(state)) {
            status=HttpStatus.CONFLICT;
            message="Reload the cycle and check its status, complete coverage, and remaining residual before retrying.";
        } else if (
            "P0001".equals(state)
            || "23514".equals(state)
            || "23502".equals(state)
            || "23503".equals(state)
        ) {
            status=HttpStatus.BAD_REQUEST;
            message="The evidence violates source lineage, amount, date, or lifecycle rules.";
        } else {
            throw error;
        }

        return ResponseEntity.status(status)
            .body(Map.of("message",message));
    }
}
