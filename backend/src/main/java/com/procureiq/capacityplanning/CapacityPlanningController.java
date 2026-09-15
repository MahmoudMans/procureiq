package com.procureiq.capacityplanning;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Year;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/capacity-planning")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class CapacityPlanningController {

    private final CapacityPlanningService service;

    public CapacityPlanningController(
            CapacityPlanningService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public CapacityPlanningDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency,

            @RequestParam(
                    required = false
            )
            Integer fiscalYear
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                ),
                currency,
                fiscalYear == null
                        ? Year.now()
                                .getValue()
                        : fiscalYear
        );
    }

    @PutMapping("/profiles/{userId}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CapacityProfileResponse saveProfile(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID userId,

            @RequestParam
            int fiscalYear,

            @Valid
            @RequestBody
            CapacityProfileInput input
    ) {
        return service.saveProfile(
                currentUserId(
                        jwt
                ),
                userId,
                fiscalYear,
                input
        );
    }

    @PostMapping("/work-estimates")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CapacityWorkItemResponse createEstimate(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            CapacityWorkEstimateInput input
    ) {
        return service.createEstimate(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @GetMapping("/work-estimates/{estimateId}")
    public CapacityWorkItemResponse workEstimate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID estimateId
    ) {
        return service.workEstimate(
                currentUserId(
                        jwt
                ),
                estimateId
        );
    }

    @PutMapping("/work-estimates/{estimateId}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CapacityWorkItemResponse updateEstimate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID estimateId,

            @Valid
            @RequestBody
            CapacityWorkEstimateUpdateInput input
    ) {
        return service.updateEstimate(
                currentUserId(
                        jwt
                ),
                estimateId,
                input
        );
    }

    @PostMapping("/work-estimates/{estimateId}/assignments")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CapacityAssignmentResponse createAssignment(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID estimateId,

            @Valid
            @RequestBody
            CapacityAssignmentInput input
    ) {
        return service.createAssignment(
                currentUserId(
                        jwt
                ),
                estimateId,
                input
        );
    }

    @DeleteMapping("/assignments/{assignmentId}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.NO_CONTENT
    )
    public void deleteAssignment(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID assignmentId
    ) {
        service.deleteAssignment(
                currentUserId(
                        jwt
                ),
                assignmentId
        );
    }

    @PostMapping("/snapshots")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CapacitySnapshotDetailResponse captureSnapshot(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency,

            @RequestParam(
                    required = false
            )
            Integer fiscalYear
    ) {
        return service.captureSnapshot(
                currentUserId(
                        jwt
                ),
                currency,
                fiscalYear == null
                        ? Year.now()
                                .getValue()
                        : fiscalYear
        );
    }

    @GetMapping("/snapshots/{snapshotId}")
    public CapacitySnapshotDetailResponse snapshot(
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
