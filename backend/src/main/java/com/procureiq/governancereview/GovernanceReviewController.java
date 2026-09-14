package com.procureiq.governancereview;

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
@RequestMapping("/api/v1/governance-reviews")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class GovernanceReviewController {

    private final GovernanceReviewService service;

    public GovernanceReviewController(
            GovernanceReviewService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public GovernanceReviewDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @GetMapping("/context-options")
    public GovernanceReviewContextResponse contextOptions(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.contextOptions(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/{reviewId}")
    public GovernanceReviewDetailResponse review(
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

    @PostMapping
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public GovernanceReviewDetailResponse createReview(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            GovernanceReviewInput input
    ) {
        return service.createReview(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PostMapping("/{reviewId}/freeze")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public GovernanceReviewDetailResponse freezeReview(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID reviewId
    ) {
        return service.freezeReview(
                currentUserId(
                        jwt
                ),
                reviewId
        );
    }

    @PostMapping("/{reviewId}/open")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public GovernanceReviewSummaryResponse openReview(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID reviewId
    ) {
        return service.openReview(
                currentUserId(
                        jwt
                ),
                reviewId
        );
    }

    @PostMapping("/{reviewId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public GovernanceReviewSummaryResponse closeReview(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID reviewId
    ) {
        return service.closeReview(
                currentUserId(
                        jwt
                ),
                reviewId
        );
    }

    @PostMapping("/{reviewId}/archive")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public GovernanceReviewSummaryResponse archiveReview(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID reviewId
    ) {
        return service.archiveReview(
                currentUserId(
                        jwt
                ),
                reviewId
        );
    }

    @PostMapping("/{reviewId}/decisions")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public GovernanceDecisionResponse createDecision(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID reviewId,

            @Valid
            @RequestBody
            GovernanceDecisionInput input
    ) {
        return service.createDecision(
                currentUserId(
                        jwt
                ),
                reviewId,
                input
        );
    }

    @PostMapping("/decisions/{decisionId}/resolve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public GovernanceDecisionResponse resolveDecision(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID decisionId,

            @Valid
            @RequestBody
            GovernanceDecisionResolutionInput input
    ) {
        return service.resolveDecision(
                currentUserId(
                        jwt
                ),
                decisionId,
                input
        );
    }

    @PostMapping("/{reviewId}/actions")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public GovernanceActionResponse createAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID reviewId,

            @Valid
            @RequestBody
            GovernanceActionInput input
    ) {
        return service.createAction(
                currentUserId(
                        jwt
                ),
                reviewId,
                input
        );
    }

    @PostMapping("/actions/{actionId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public GovernanceActionResponse startAction(
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
    public GovernanceActionResponse completeAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId,

            @Valid
            @RequestBody
            GovernanceActionCompletionInput input
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
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public GovernanceActionResponse cancelAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId,

            @Valid
            @RequestBody
            GovernanceActionCompletionInput input
    ) {
        return service.cancelAction(
                currentUserId(
                        jwt
                ),
                actionId,
                input
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
