package com.procureiq.sustainability;

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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/sustainability")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class SustainabilityController {

    private final SustainabilityService service;

    public SustainabilityController(
            SustainabilityService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public List<SustainabilityPortfolioResponse> portfolio(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.portfolio(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @GetMapping("/summary")
    public SustainabilitySummaryResponse summary(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.summary(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @GetMapping("/categories")
    public List<SustainabilityCategoryExposureResponse> categories(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.categories(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @GetMapping("/context-options")
    public SustainabilityContextResponse contextOptions(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.contextOptions(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/assessments/{assessmentId}")
    public SustainabilityAssessmentResponse assessment(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID assessmentId
    ) {
        return service.assessment(
                currentUserId(
                        jwt
                ),
                assessmentId
        );
    }

    @PostMapping("/assessments")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public SustainabilityAssessmentResponse createAssessment(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            SustainabilityAssessmentInput input
    ) {
        return service.createAssessment(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PostMapping("/assessments/{assessmentId}/submit")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SustainabilityAssessmentResponse submitAssessment(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID assessmentId
    ) {
        return service.submitAssessment(
                currentUserId(
                        jwt
                ),
                assessmentId
        );
    }

    @PostMapping("/assessments/{assessmentId}/declarations/{declarationType}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SustainabilityAssessmentResponse uploadDeclaration(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID assessmentId,

            @PathVariable
            SustainabilityDeclarationType declarationType,

            @Valid
            @RequestBody
            SustainabilityDeclarationInput input
    ) {
        return service.uploadDeclaration(
                currentUserId(
                        jwt
                ),
                assessmentId,
                declarationType,
                input
        );
    }

    @PostMapping("/declarations/{declarationId}/verify")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SustainabilityDeclarationResponse verifyDeclaration(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID declarationId,

            @Valid
            @RequestBody
            SustainabilityDecisionInput input
    ) {
        return service.verifyDeclaration(
                currentUserId(
                        jwt
                ),
                declarationId,
                input
        );
    }

    @PostMapping("/declarations/{declarationId}/reject")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SustainabilityDeclarationResponse rejectDeclaration(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID declarationId,

            @Valid
            @RequestBody
            SustainabilityDecisionInput input
    ) {
        return service.rejectDeclaration(
                currentUserId(
                        jwt
                ),
                declarationId,
                input
        );
    }

    @PostMapping("/assessments/{assessmentId}/approve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SustainabilityAssessmentResponse approveAssessment(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID assessmentId,

            @Valid
            @RequestBody
            SustainabilityDecisionInput input
    ) {
        return service.approveAssessment(
                currentUserId(
                        jwt
                ),
                assessmentId,
                input
        );
    }

    @PostMapping("/assessments/{assessmentId}/reject")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SustainabilityAssessmentResponse rejectAssessment(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID assessmentId,

            @Valid
            @RequestBody
            SustainabilityDecisionInput input
    ) {
        return service.rejectAssessment(
                currentUserId(
                        jwt
                ),
                assessmentId,
                input
        );
    }

    @PostMapping("/assessments/{assessmentId}/actions")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public SustainabilityActionResponse createAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID assessmentId,

            @Valid
            @RequestBody
            SustainabilityActionInput input
    ) {
        return service.createAction(
                currentUserId(
                        jwt
                ),
                assessmentId,
                input
        );
    }

    @PostMapping("/actions/{actionId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SustainabilityActionResponse startAction(
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
    public SustainabilityActionResponse completeAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId,

            @Valid
            @RequestBody
            SustainabilityActionCompletionInput input
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
    public SustainabilityActionResponse cancelAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId
    ) {
        return service.cancelAction(
                currentUserId(
                        jwt
                ),
                actionId
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
