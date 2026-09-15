package com.procureiq.strategyexecution;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/strategy-execution")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class StrategyExecutionController {

    private final StrategyExecutionService service;

    public StrategyExecutionController(
            StrategyExecutionService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public StrategyExecutionDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/import")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public StrategyExecutionDashboardResponse importRoadmap(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam
            UUID roadmapId
    ) {
        return service.importRoadmap(
                currentUserId(
                        jwt
                ),
                roadmapId
        );
    }

    @GetMapping("/commitments/{commitmentId}")
    public ExecutionCommitmentDetailResponse commitment(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID commitmentId
    ) {
        return service.commitment(
                currentUserId(
                        jwt
                ),
                commitmentId
        );
    }

    @PostMapping("/commitments/{commitmentId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ExecutionCommitmentDetailResponse startCommitment(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID commitmentId
    ) {
        return service.startCommitment(
                currentUserId(
                        jwt
                ),
                commitmentId
        );
    }

    @PostMapping("/commitments/{commitmentId}/progress")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public ExecutionCommitmentDetailResponse recordProgress(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID commitmentId,

            @Valid
            @RequestBody
            ExecutionProgressInput input
    ) {
        return service.recordProgress(
                currentUserId(
                        jwt
                ),
                commitmentId,
                input
        );
    }

    @PostMapping("/commitments/{commitmentId}/complete")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ExecutionCommitmentDetailResponse completeCommitment(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID commitmentId
    ) {
        return service.completeCommitment(
                currentUserId(
                        jwt
                ),
                commitmentId
        );
    }

    @PostMapping("/commitments/{commitmentId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public ExecutionCommitmentDetailResponse cancelCommitment(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID commitmentId
    ) {
        return service.cancelCommitment(
                currentUserId(
                        jwt
                ),
                commitmentId
        );
    }

    @PostMapping("/commitments/{commitmentId}/outcomes")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public ExecutionCommitmentDetailResponse reportOutcome(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID commitmentId,

            @Valid
            @RequestBody
            ExecutionOutcomeInput input
    ) {
        return service.reportOutcome(
                currentUserId(
                        jwt
                ),
                commitmentId,
                input
        );
    }

    @PostMapping("/outcomes/{outcomeId}/validate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public ExecutionCommitmentDetailResponse validateOutcome(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID outcomeId,

            @Valid
            @RequestBody
            ExecutionOutcomeValidationInput input
    ) {
        return service.validateOutcome(
                currentUserId(
                        jwt
                ),
                outcomeId,
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
    public ExecutionReviewDetailResponse captureReview(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam
            UUID roadmapId
    ) {
        return service.captureReview(
                currentUserId(
                        jwt
                ),
                roadmapId
        );
    }

    @GetMapping("/reviews/{reviewId}")
    public ExecutionReviewDetailResponse review(
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
