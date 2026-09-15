package com.procureiq.reinvestmentperformance;

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
@RequestMapping("/api/v1/reinvestment-performance")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class ReinvestmentPerformanceController {

    private final ReinvestmentPerformanceService service;

    public ReinvestmentPerformanceController(
            ReinvestmentPerformanceService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public ReinvestmentPerformanceDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/redeployments/{redeploymentCaseId}/cases")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public ReinvestmentPerformanceCaseDetailResponse createCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID redeploymentCaseId,

            @Valid
            @RequestBody
            ReinvestmentPerformanceCaseInput input
    ) {
        return service.createCase(
                currentUserId(
                        jwt
                ),
                redeploymentCaseId,
                input
        );
    }

    @GetMapping("/cases/{caseId}")
    public ReinvestmentPerformanceCaseDetailResponse performanceCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId
    ) {
        return service.performanceCase(
                currentUserId(
                        jwt
                ),
                caseId
        );
    }

    @PostMapping("/cases/{caseId}/observations")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public ReinvestmentPerformanceCaseDetailResponse recordObservation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            ReinvestmentPerformanceObservationInput input
    ) {
        return service.recordObservation(
                currentUserId(
                        jwt
                ),
                caseId,
                input
        );
    }

    @PostMapping("/observations/{observationId}/validate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public ReinvestmentPerformanceCaseDetailResponse validateObservation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID observationId,

            @Valid
            @RequestBody
            ReinvestmentPerformanceValidationInput input
    ) {
        return service.validateObservation(
                currentUserId(
                        jwt
                ),
                observationId,
                input
        );
    }

    @PostMapping("/cases/{caseId}/ready-for-review")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ReinvestmentPerformanceCaseDetailResponse submitForReview(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId
    ) {
        return service.submitForReview(
                currentUserId(
                        jwt
                ),
                caseId
        );
    }

    @PostMapping("/cases/{caseId}/review")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public ReinvestmentPerformanceCaseDetailResponse reviewCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            ReinvestmentPerformanceReviewInput input
    ) {
        return service.reviewCase(
                currentUserId(
                        jwt
                ),
                caseId,
                input
        );
    }

    @PostMapping("/cases/{caseId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public ReinvestmentPerformanceCaseDetailResponse closeCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            ReinvestmentPerformanceNoteInput input
    ) {
        return service.closeCase(
                currentUserId(
                        jwt
                ),
                caseId,
                input
        );
    }

    @PostMapping("/snapshots")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public ReinvestmentPerformanceSnapshotDetailResponse captureSnapshot(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.captureSnapshot(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/snapshots/{snapshotId}")
    public ReinvestmentPerformanceSnapshotDetailResponse snapshot(
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
