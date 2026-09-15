package com.procureiq.reinvestmentpersistence;

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
@RequestMapping("/api/v1/reinvestment-persistence")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class ReinvestmentPersistenceController {

    private final ReinvestmentPersistenceService service;

    public ReinvestmentPersistenceController(
            ReinvestmentPersistenceService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public ReinvestmentPersistenceDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/performance-cases/{performanceCaseId}/cases")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public ReinvestmentPersistenceCaseDetailResponse createCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID performanceCaseId,

            @Valid
            @RequestBody
            ReinvestmentPersistenceCaseInput input
    ) {
        return service.createCase(
                currentUserId(
                        jwt
                ),
                performanceCaseId,
                input
        );
    }

    @GetMapping("/cases/{caseId}")
    public ReinvestmentPersistenceCaseDetailResponse persistenceCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId
    ) {
        return service.persistenceCase(
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
    public ReinvestmentPersistenceCaseDetailResponse recordObservation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            ReinvestmentPersistenceObservationInput input
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
    public ReinvestmentPersistenceCaseDetailResponse validateObservation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID observationId,

            @Valid
            @RequestBody
            ReinvestmentPersistenceValidationInput input
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
    public ReinvestmentPersistenceCaseDetailResponse submitForReview(
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
    public ReinvestmentPersistenceCaseDetailResponse reviewCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            ReinvestmentPersistenceReviewInput input
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
    public ReinvestmentPersistenceCaseDetailResponse closeCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            ReinvestmentPersistenceNoteInput input
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
    public ReinvestmentPersistenceSnapshotDetailResponse captureSnapshot(
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
    public ReinvestmentPersistenceSnapshotDetailResponse snapshot(
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
