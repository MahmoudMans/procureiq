package com.procureiq.strategyrecovery;

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
@RequestMapping("/api/v1/strategy-recovery")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class StrategyRecoveryController {

    private final StrategyRecoveryService service;

    public StrategyRecoveryController(
            StrategyRecoveryService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public StrategyRecoveryDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/commitments/{commitmentId}/cases")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public RecoveryCaseDetailResponse openCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID commitmentId,

            @Valid
            @RequestBody
            RecoveryCaseInput input
    ) {
        return service.openCase(
                currentUserId(
                        jwt
                ),
                commitmentId,
                input
        );
    }

    @GetMapping("/cases/{caseId}")
    public RecoveryCaseDetailResponse recoveryCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId
    ) {
        return service.recoveryCase(
                currentUserId(
                        jwt
                ),
                caseId
        );
    }

    @PostMapping("/cases/{caseId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public RecoveryCaseDetailResponse startRecovery(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId
    ) {
        return service.startRecovery(
                currentUserId(
                        jwt
                ),
                caseId
        );
    }

    @PostMapping("/cases/{caseId}/actions")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public RecoveryCaseDetailResponse createAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            RecoveryActionInput input
    ) {
        return service.createAction(
                currentUserId(
                        jwt
                ),
                caseId,
                input
        );
    }

    @PostMapping("/actions/{actionId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public RecoveryCaseDetailResponse startAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId
    ) {
        return service.startAction(
                currentUserId(
                        jwt
                ),
                actionId
        );
    }

    @PostMapping("/actions/{actionId}/complete")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public RecoveryCaseDetailResponse completeAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId,

            @Valid
            @RequestBody
            RecoveryNoteInput input
    ) {
        return service.completeAction(
                currentUserId(
                        jwt
                ),
                actionId,
                input
        );
    }

    @PostMapping("/actions/{actionId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public RecoveryCaseDetailResponse cancelAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId,

            @Valid
            @RequestBody
            RecoveryNoteInput input
    ) {
        return service.cancelAction(
                currentUserId(
                        jwt
                ),
                actionId,
                input
        );
    }

    @PostMapping("/cases/{caseId}/checkpoints")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public RecoveryCaseDetailResponse captureCheckpoint(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            RecoveryCheckpointInput input
    ) {
        return service.captureCheckpoint(
                currentUserId(
                        jwt
                ),
                caseId,
                input
        );
    }

    @PostMapping("/cases/{caseId}/escalations")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public RecoveryCaseDetailResponse escalate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            RecoveryEscalationInput input
    ) {
        return service.escalate(
                currentUserId(
                        jwt
                ),
                caseId,
                input
        );
    }

    @PostMapping("/cases/{caseId}/ready-for-verification")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public RecoveryCaseDetailResponse markReadyForVerification(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId
    ) {
        return service.markReadyForVerification(
                currentUserId(
                        jwt
                ),
                caseId
        );
    }

    @PostMapping("/cases/{caseId}/verify")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public RecoveryCaseDetailResponse verify(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            RecoveryNoteInput input
    ) {
        return service.verify(
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
    public RecoveryCaseDetailResponse close(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            RecoveryNoteInput input
    ) {
        return service.close(
                currentUserId(
                        jwt
                ),
                caseId,
                input
        );
    }

    @PostMapping("/reviews")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public RecoveryReviewDetailResponse captureReview(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.captureReview(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/reviews/{reviewId}")
    public RecoveryReviewDetailResponse review(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID reviewId
    ) {
        return service.review(
                currentUserId(
                        jwt
                ),
                reviewId
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
