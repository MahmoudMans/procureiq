package com.procureiq.flywheelvariance;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/flywheel-variance")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class FlywheelVarianceController {

    private final FlywheelVarianceService service;

    public FlywheelVarianceController(
            FlywheelVarianceService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public FlywheelVarianceDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/plans")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FlywheelVariancePlanDetailResponse createPlan(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            FlywheelVariancePlanInput input
    ) {
        return service.createPlan(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @GetMapping("/plans/{planId}")
    public FlywheelVariancePlanDetailResponse plan(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID planId
    ) {
        return service.plan(
                currentUserId(
                        jwt
                ),
                planId
        );
    }

    @PostMapping("/plans/{planId}/items")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FlywheelVariancePlanDetailResponse addItem(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID planId,

            @Valid
            @RequestBody
            FlywheelVarianceItemInput input
    ) {
        return service.addItem(
                currentUserId(
                        jwt
                ),
                planId,
                input
        );
    }

    @PostMapping("/plans/{planId}/ready-for-review")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public FlywheelVariancePlanDetailResponse submitForReview(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID planId
    ) {
        return service.submitForReview(
                currentUserId(
                        jwt
                ),
                planId
        );
    }

    @PostMapping("/plans/{planId}/approve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public FlywheelVariancePlanDetailResponse approve(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID planId,

            @Valid
            @RequestBody
            FlywheelVarianceNoteInput input
    ) {
        return service.approve(
                currentUserId(
                        jwt
                ),
                planId,
                input
        );
    }

    @PostMapping("/plans/{planId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public FlywheelVariancePlanDetailResponse close(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID planId,

            @Valid
            @RequestBody
            FlywheelVarianceNoteInput input
    ) {
        return service.close(
                currentUserId(
                        jwt
                ),
                planId,
                input
        );
    }

    @PostMapping("/plans/{planId}/snapshots")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FlywheelVarianceSnapshotDetailResponse captureSnapshot(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID planId
    ) {
        return service.captureSnapshot(
                currentUserId(
                        jwt
                ),
                planId
        );
    }

    @GetMapping("/snapshots/{snapshotId}")
    public FlywheelVarianceSnapshotDetailResponse snapshot(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID snapshotId
    ) {
        return service.snapshot(
                currentUserId(
                        jwt
                ),
                snapshotId
        );
    }

    private UUID currentUserId(
            Jwt jwt
    ) {
        try {
            return UUID.fromString(
                    jwt.getSubject()
            );

        } catch (
                IllegalArgumentException exception
        ) {
            throw new IllegalArgumentException(
                    "Invalid authenticated ProcureIQ identity."
            );
        }
    }
}
