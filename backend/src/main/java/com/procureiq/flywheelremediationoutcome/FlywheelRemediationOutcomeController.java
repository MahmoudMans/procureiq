package com.procureiq.flywheelremediationoutcome;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping(
        "/api/v1/flywheel-remediation-outcomes"
)
public class FlywheelRemediationOutcomeController {

    private final FlywheelRemediationOutcomeService service;

    public FlywheelRemediationOutcomeController(
            FlywheelRemediationOutcomeService service
    ) {
        this.service = service;
    }

    @GetMapping(
            "/dashboard"
    )
    @PreAuthorize(
            "hasAnyRole('APPROVER','BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelRemediationOutcomeDashboardResponse dashboard(
            JwtAuthenticationToken authentication
    ) {
        return service.dashboard(
                userId(
                        authentication
                )
        );
    }

    @PostMapping(
            "/cases"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    @PreAuthorize(
            "hasAnyRole('BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelRemediationOutcomeCaseDetailResponse createCase(
            JwtAuthenticationToken authentication,
            @Valid
            @RequestBody
            FlywheelRemediationOutcomeCaseInput input
    ) {
        return service.createCase(
                userId(
                        authentication
                ),
                input
        );
    }

    @GetMapping(
            "/cases/{id}"
    )
    @PreAuthorize(
            "hasAnyRole('APPROVER','BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelRemediationOutcomeCaseDetailResponse outcomeCase(
            JwtAuthenticationToken authentication,
            @PathVariable
            UUID id
    ) {
        return service.outcomeCase(
                userId(
                        authentication
                ),
                id
        );
    }

    @PostMapping(
            "/cases/{id}/items"
    )
    @PreAuthorize(
            "hasAnyRole('BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelRemediationOutcomeCaseDetailResponse addItem(
            JwtAuthenticationToken authentication,
            @PathVariable
            UUID id,
            @Valid
            @RequestBody
            FlywheelRemediationOutcomeItemInput input
    ) {
        return service.addItem(
                userId(
                        authentication
                ),
                id,
                input
        );
    }

    @PostMapping(
            "/cases/{id}/submit"
    )
    @PreAuthorize(
            "hasAnyRole('BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelRemediationOutcomeCaseDetailResponse submit(
            JwtAuthenticationToken authentication,
            @PathVariable
            UUID id
    ) {
        return service.submit(
                userId(
                        authentication
                ),
                id
        );
    }

    @PostMapping(
            "/cases/{id}/verify"
    )
    @PreAuthorize(
            "hasAnyRole('PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelRemediationOutcomeCaseDetailResponse verify(
            JwtAuthenticationToken authentication,
            @PathVariable
            UUID id,
            @Valid
            @RequestBody
            FlywheelRemediationOutcomeNoteInput input
    ) {
        return service.verify(
                userId(
                        authentication
                ),
                id,
                input
        );
    }

    @PostMapping(
            "/cases/{id}/close"
    )
    @PreAuthorize(
            "hasAnyRole('PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelRemediationOutcomeCaseDetailResponse close(
            JwtAuthenticationToken authentication,
            @PathVariable
            UUID id,
            @Valid
            @RequestBody
            FlywheelRemediationOutcomeNoteInput input
    ) {
        return service.close(
                userId(
                        authentication
                ),
                id,
                input
        );
    }

    @PostMapping(
            "/cases/{id}/snapshots"
    )
    @PreAuthorize(
            "hasAnyRole('BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelRemediationOutcomeSnapshotDetailResponse snapshot(
            JwtAuthenticationToken authentication,
            @PathVariable
            UUID id
    ) {
        return service.captureSnapshot(
                userId(
                        authentication
                ),
                id
        );
    }

    @GetMapping(
            "/snapshots/{id}"
    )
    @PreAuthorize(
            "hasAnyRole('APPROVER','BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelRemediationOutcomeSnapshotDetailResponse snapshotDetail(
            JwtAuthenticationToken authentication,
            @PathVariable
            UUID id
    ) {
        return service.snapshot(
                userId(
                        authentication
                ),
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

        } catch (
                RuntimeException exception
        ) {
            throw new IllegalArgumentException(
                    "Authenticated subject must be a UUID.",
                    exception
            );
        }
    }
}
