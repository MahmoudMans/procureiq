package com.procureiq.investmentperformance;

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
@RequestMapping("/api/v1/investment-performance")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class InvestmentPerformanceController {

    private final InvestmentPerformanceService service;

    public InvestmentPerformanceController(
            InvestmentPerformanceService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public InvestmentPerformanceDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/funding-commitments/{fundingCommitmentId}/cases")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public InvestmentPerformanceCaseDetailResponse createCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID fundingCommitmentId,

            @Valid
            @RequestBody
            InvestmentPerformanceCaseInput input
    ) {
        return service.createCase(
                currentUserId(
                        jwt
                ),
                fundingCommitmentId,
                input
        );
    }

    @GetMapping("/cases/{caseId}")
    public InvestmentPerformanceCaseDetailResponse performanceCase(
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
    public InvestmentPerformanceCaseDetailResponse recordObservation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            InvestmentPerformanceObservationInput input
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
    public InvestmentPerformanceCaseDetailResponse validateObservation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID observationId,

            @Valid
            @RequestBody
            InvestmentPerformanceValidationInput input
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
    public InvestmentPerformanceCaseDetailResponse submitForReview(
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
    public InvestmentPerformanceCaseDetailResponse reviewCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            InvestmentPerformanceReviewInput input
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
    public InvestmentPerformanceCaseDetailResponse closeCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            InvestmentPerformanceNoteInput input
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
    public InvestmentPerformanceSnapshotDetailResponse captureSnapshot(
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
    public InvestmentPerformanceSnapshotDetailResponse snapshot(
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
