package com.procureiq.supplierperformance;

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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/supplier-performance")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class SupplierPerformanceController {

    private final SupplierPerformanceService service;

    public SupplierPerformanceController(
            SupplierPerformanceService service
    ) {
        this.service =
                service;
    }

    @GetMapping("/reviews")
    public List<SupplierPerformanceReviewResponse> reviews(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.reviews(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/reviews/{reviewId}")
    public SupplierPerformanceReviewDetailResponse detail(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID reviewId
    ) {
        return service.detail(
                currentUserId(
                        jwt
                ),
                reviewId
        );
    }

    @PostMapping("/reviews")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public SupplierPerformanceReviewResponse create(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            SupplierPerformanceReviewInput input
    ) {
        return service.create(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PostMapping("/reviews/{reviewId}/submit")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SupplierPerformanceReviewResponse submit(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID reviewId
    ) {
        return service.submit(
                currentUserId(
                        jwt
                ),
                reviewId
        );
    }

    @PostMapping("/reviews/{reviewId}/approve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SupplierPerformanceReviewResponse approve(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID reviewId,

            @Valid
            @RequestBody
            PerformanceDecisionInput input
    ) {
        return service.approve(
                currentUserId(
                        jwt
                ),
                reviewId,
                input
        );
    }

    @PostMapping("/reviews/{reviewId}/reject")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SupplierPerformanceReviewResponse reject(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID reviewId,

            @Valid
            @RequestBody
            PerformanceDecisionInput input
    ) {
        return service.reject(
                currentUserId(
                        jwt
                ),
                reviewId,
                input
        );
    }

    @PostMapping("/reviews/{reviewId}/corrective-actions")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CorrectiveActionResponse addCorrectiveAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID reviewId,

            @Valid
            @RequestBody
            CorrectiveActionInput input
    ) {
        return service.addCorrectiveAction(
                currentUserId(
                        jwt
                ),
                reviewId,
                input
        );
    }

    @PostMapping("/corrective-actions/{actionId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CorrectiveActionResponse startCorrectiveAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId
    ) {
        return service.startCorrectiveAction(
                currentUserId(
                        jwt
                ),
                actionId
        );
    }

    @PostMapping("/corrective-actions/{actionId}/complete")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CorrectiveActionResponse completeCorrectiveAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId,

            @Valid
            @RequestBody
            CorrectiveActionCompletionInput input
    ) {
        return service.completeCorrectiveAction(
                currentUserId(
                        jwt
                ),
                actionId,
                input
        );
    }

    @PostMapping("/corrective-actions/{actionId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public CorrectiveActionResponse cancelCorrectiveAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId
    ) {
        return service.cancelCorrectiveAction(
                currentUserId(
                        jwt
                ),
                actionId
        );
    }

    @GetMapping("/summary")
    public SupplierPerformanceSummaryResponse summary(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.summary(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/suppliers/{supplierId}/history")
    public List<SupplierPerformanceTrendResponse> history(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID supplierId
    ) {
        return service.supplierHistory(
                currentUserId(
                        jwt
                ),
                supplierId
        );
    }

    @GetMapping("/context-options")
    public SupplierPerformanceContextResponse contextOptions(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.contextOptions(
                currentUserId(
                        jwt
                )
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
