package com.procureiq.flywheelremediation;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping(
        "/api/v1/flywheel-remediation"
)
public class FlywheelResidualRemediationController {

    private final FlywheelResidualRemediationService service;

    public FlywheelResidualRemediationController(
            FlywheelResidualRemediationService service
    ) {
        this.service = service;
    }

    @GetMapping(
            "/dashboard"
    )
    @PreAuthorize(
            "hasAnyRole('APPROVER','BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelResidualRemediationDashboardResponse dashboard(
            JwtAuthenticationToken authentication
    ) {
        return service.dashboard(
                userId(
                        authentication
                )
        );
    }

    @GetMapping(
            "/sources"
    )
    @PreAuthorize(
            "hasAnyRole('APPROVER','BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public List<FlywheelResidualRemediationSourceResponse> sources(
            JwtAuthenticationToken authentication
    ) {
        return service.sources(
                userId(
                        authentication
                )
        );
    }

    @PostMapping(
            "/plans"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    @PreAuthorize(
            "hasAnyRole('BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelResidualRemediationPlanDetailResponse create(
            JwtAuthenticationToken authentication,
            @Valid
            @RequestBody
            FlywheelResidualRemediationPlanInput input
    ) {
        return service.createPlan(
                userId(
                        authentication
                ),
                input
        );
    }

    @GetMapping(
            "/plans/{id}"
    )
    @PreAuthorize(
            "hasAnyRole('APPROVER','BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelResidualRemediationPlanDetailResponse plan(
            JwtAuthenticationToken authentication,
            @PathVariable
            UUID id
    ) {
        return service.plan(
                userId(
                        authentication
                ),
                id
        );
    }

    @PostMapping(
            "/plans/{id}/items"
    )
    @PreAuthorize(
            "hasAnyRole('BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelResidualRemediationPlanDetailResponse addItem(
            JwtAuthenticationToken authentication,
            @PathVariable
            UUID id,
            @Valid
            @RequestBody
            FlywheelResidualRemediationItemInput input
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
            "/plans/{id}/submit"
    )
    @PreAuthorize(
            "hasAnyRole('BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelResidualRemediationPlanDetailResponse submit(
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
            "/plans/{id}/approve"
    )
    @PreAuthorize(
            "hasAnyRole('PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelResidualRemediationPlanDetailResponse approve(
            JwtAuthenticationToken authentication,
            @PathVariable
            UUID id,
            @Valid
            @RequestBody
            FlywheelResidualRemediationNoteInput input
    ) {
        return service.approve(
                userId(
                        authentication
                ),
                id,
                input
        );
    }

    @PostMapping(
            "/plans/{id}/close"
    )
    @PreAuthorize(
            "hasAnyRole('PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelResidualRemediationPlanDetailResponse close(
            JwtAuthenticationToken authentication,
            @PathVariable
            UUID id,
            @Valid
            @RequestBody
            FlywheelResidualRemediationNoteInput input
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
            "/plans/{id}/snapshots"
    )
    @PreAuthorize(
            "hasAnyRole('BUYER','PROCUREMENT_MANAGER','ADMIN')"
    )
    public FlywheelResidualRemediationSnapshotDetailResponse captureSnapshot(
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
    public FlywheelResidualRemediationSnapshotDetailResponse snapshot(
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
