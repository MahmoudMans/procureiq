package com.procureiq.outcomepersistence;

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
@RequestMapping("/api/v1/outcome-persistence")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class OutcomePersistenceController {

    private final OutcomePersistenceService service;

    public OutcomePersistenceController(
            OutcomePersistenceService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public OutcomePersistenceDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/commitments/{commitmentId}/plans")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public PersistencePlanDetailResponse createPlan(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID commitmentId,

            @Valid
            @RequestBody
            PersistencePlanInput input
    ) {
        return service.createPlan(
                currentUserId(
                        jwt
                ),
                commitmentId,
                input
        );
    }

    @GetMapping("/plans/{planId}")
    public PersistencePlanDetailResponse plan(
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

    @PostMapping("/plans/{planId}/observations")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public PersistencePlanDetailResponse recordObservation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID planId,

            @Valid
            @RequestBody
            PersistenceObservationInput input
    ) {
        return service.recordObservation(
                currentUserId(
                        jwt
                ),
                planId,
                input
        );
    }

    @PostMapping("/observations/{observationId}/validate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public PersistencePlanDetailResponse validateObservation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID observationId,

            @Valid
            @RequestBody
            PersistenceObservationValidationInput input
    ) {
        return service.validateObservation(
                currentUserId(
                        jwt
                ),
                observationId,
                input
        );
    }

    @PostMapping("/plans/{planId}/controls")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public PersistencePlanDetailResponse createControl(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID planId,

            @Valid
            @RequestBody
            PersistenceControlInput input
    ) {
        return service.createControl(
                currentUserId(
                        jwt
                ),
                planId,
                input
        );
    }

    @PostMapping("/controls/{controlId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public PersistencePlanDetailResponse startControl(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID controlId
    ) {
        return service.startControl(
                currentUserId(
                        jwt
                ),
                controlId
        );
    }

    @PostMapping("/controls/{controlId}/complete")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public PersistencePlanDetailResponse completeControl(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID controlId,

            @Valid
            @RequestBody
            PersistenceNoteInput input
    ) {
        return service.completeControl(
                currentUserId(
                        jwt
                ),
                controlId,
                input
        );
    }

    @PostMapping("/controls/{controlId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public PersistencePlanDetailResponse cancelControl(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID controlId,

            @Valid
            @RequestBody
            PersistenceNoteInput input
    ) {
        return service.cancelControl(
                currentUserId(
                        jwt
                ),
                controlId,
                input
        );
    }

    @PostMapping("/plans/{planId}/ready-for-review")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public PersistencePlanDetailResponse submitForReview(
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

    @PostMapping("/plans/{planId}/verify")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public PersistencePlanDetailResponse verifyPersistence(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID planId,

            @Valid
            @RequestBody
            PersistenceVerificationInput input
    ) {
        return service.verifyPersistence(
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
    public PersistencePlanDetailResponse closePlan(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID planId,

            @Valid
            @RequestBody
            PersistenceNoteInput input
    ) {
        return service.closePlan(
                currentUserId(
                        jwt
                ),
                planId,
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
    public PersistenceReviewDetailResponse captureReview(
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
    public PersistenceReviewDetailResponse review(
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
