package com.procureiq.flywheelcontinuation;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping(
        "/api/v1/flywheel-remediation-continuations"
)
public class FlywheelResidualContinuationController {

    private final FlywheelResidualContinuationService service;

    public FlywheelResidualContinuationController(
            FlywheelResidualContinuationService service
    ) {
        this.service = service;
    }

    @GetMapping("/dashboard")
    @PreAuthorize(
            "hasAnyRole('APPROVER','BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelResidualContinuationDashboardResponse dashboard(
            JwtAuthenticationToken authentication
    ) {
        return service.dashboard(
                userId(authentication)
        );
    }

    @PostMapping("/cases")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(
            "hasAnyRole('BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelResidualContinuationCaseDetailResponse createCase(
            JwtAuthenticationToken authentication,
            @Valid
            @RequestBody
            FlywheelResidualContinuationCaseInput input
    ) {
        return service.createCase(
                userId(authentication),
                input
        );
    }

    @GetMapping("/cases/{id}")
    @PreAuthorize(
            "hasAnyRole('APPROVER','BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelResidualContinuationCaseDetailResponse continuationCase(
            JwtAuthenticationToken authentication,
            @PathVariable
            UUID id
    ) {
        return service.continuationCase(
                userId(authentication),
                id
        );
    }

    @PostMapping("/cases/{id}/items")
    @PreAuthorize(
            "hasAnyRole('BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelResidualContinuationCaseDetailResponse addItem(
            JwtAuthenticationToken authentication,
            @PathVariable
            UUID id,
            @Valid
            @RequestBody
            FlywheelResidualContinuationItemInput input
    ) {
        return service.addItem(
                userId(authentication),
                id,
                input
        );
    }

    @PostMapping("/cases/{id}/submit")
    @PreAuthorize(
            "hasAnyRole('BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelResidualContinuationCaseDetailResponse submit(
            JwtAuthenticationToken authentication,
            @PathVariable
            UUID id
    ) {
        return service.submit(
                userId(authentication),
                id
        );
    }

    @PostMapping("/cases/{id}/approve")
    @PreAuthorize(
            "hasAnyRole('PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelResidualContinuationCaseDetailResponse approve(
            JwtAuthenticationToken authentication,
            @PathVariable
            UUID id,
            @Valid
            @RequestBody
            FlywheelResidualContinuationNoteInput input
    ) {
        return service.approve(
                userId(authentication),
                id,
                input
        );
    }

    @PostMapping("/cases/{id}/close")
    @PreAuthorize(
            "hasAnyRole('PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelResidualContinuationCaseDetailResponse close(
            JwtAuthenticationToken authentication,
            @PathVariable
            UUID id,
            @Valid
            @RequestBody
            FlywheelResidualContinuationNoteInput input
    ) {
        return service.close(
                userId(authentication),
                id,
                input
        );
    }

    @PostMapping("/cases/{id}/snapshots")
    @PreAuthorize(
            "hasAnyRole('BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelResidualContinuationSnapshotDetailResponse snapshot(
            JwtAuthenticationToken authentication,
            @PathVariable
            UUID id
    ) {
        return service.captureSnapshot(
                userId(authentication),
                id
        );
    }

    @GetMapping("/snapshots/{id}")
    @PreAuthorize(
            "hasAnyRole('APPROVER','BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelResidualContinuationSnapshotDetailResponse snapshotDetail(
            JwtAuthenticationToken authentication,
            @PathVariable
            UUID id
    ) {
        return service.snapshot(
                userId(authentication),
                id
        );
    }

    private UUID userId(
            JwtAuthenticationToken authentication
    ) {
        try {
            return UUID.fromString(
                    authentication
                            .getToken()
                            .getSubject()
            );

        } catch (RuntimeException exception) {
            throw new IllegalArgumentException(
                    "Authenticated subject must be a UUID.",
                    exception
            );
        }
    }
}
