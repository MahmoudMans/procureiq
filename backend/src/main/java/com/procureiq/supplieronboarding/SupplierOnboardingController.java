package com.procureiq.supplieronboarding;

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
@RequestMapping("/api/v1/supplier-onboarding")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class SupplierOnboardingController {

    private final SupplierOnboardingService service;

    public SupplierOnboardingController(
            SupplierOnboardingService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public List<SupplierOnboardingCaseResponse> cases(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.cases(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/summary")
    public SupplierOnboardingSummaryResponse summary(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.summary(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/context-options")
    public SupplierOnboardingContextResponse contextOptions(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.contextOptions(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/cases/{caseId}")
    public SupplierOnboardingCaseResponse caseDetail(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId
    ) {
        return service.caseDetail(
                currentUserId(
                        jwt
                ),
                caseId
        );
    }

    @PostMapping("/cases")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public SupplierOnboardingCaseResponse createCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            SupplierOnboardingCaseInput input
    ) {
        return service.createCase(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PostMapping("/cases/{caseId}/questions/{questionCode}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SupplierOnboardingCaseResponse answerQuestion(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @PathVariable
            String questionCode,

            @Valid
            @RequestBody
            QualificationAnswerInput input
    ) {
        return service.answerQuestion(
                currentUserId(
                        jwt
                ),
                caseId,
                questionCode,
                input
        );
    }

    @PostMapping("/cases/{caseId}/evidence/{evidenceType}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SupplierOnboardingCaseResponse uploadEvidence(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @PathVariable
            OnboardingEvidenceType evidenceType,

            @Valid
            @RequestBody
            OnboardingEvidenceInput input
    ) {
        return service.uploadEvidence(
                currentUserId(
                        jwt
                ),
                caseId,
                evidenceType,
                input
        );
    }

    @PostMapping("/evidence/{evidenceId}/validate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public OnboardingEvidenceResponse validateEvidence(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID evidenceId,

            @Valid
            @RequestBody
            OnboardingDecisionInput input
    ) {
        return service.validateEvidence(
                currentUserId(
                        jwt
                ),
                evidenceId,
                input
        );
    }

    @PostMapping("/evidence/{evidenceId}/reject")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public OnboardingEvidenceResponse rejectEvidence(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID evidenceId,

            @Valid
            @RequestBody
            OnboardingDecisionInput input
    ) {
        return service.rejectEvidence(
                currentUserId(
                        jwt
                ),
                evidenceId,
                input
        );
    }

    @PostMapping("/cases/{caseId}/submit")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SupplierOnboardingCaseResponse submitCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId
    ) {
        return service.submitCase(
                currentUserId(
                        jwt
                ),
                caseId
        );
    }

    @PostMapping("/approvals/{approvalId}/approve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','APPROVER')"
    )
    public OnboardingApprovalResponse approve(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID approvalId,

            @Valid
            @RequestBody
            OnboardingDecisionInput input
    ) {
        return service.approve(
                currentUserId(
                        jwt
                ),
                approvalId,
                input
        );
    }

    @PostMapping("/approvals/{approvalId}/reject")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','APPROVER')"
    )
    public OnboardingApprovalResponse rejectApproval(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID approvalId,

            @Valid
            @RequestBody
            OnboardingDecisionInput input
    ) {
        return service.rejectApproval(
                currentUserId(
                        jwt
                ),
                approvalId,
                input
        );
    }

    @PostMapping("/cases/{caseId}/finalize")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SupplierOnboardingCaseResponse finalizeCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            OnboardingDecisionInput input
    ) {
        return service.finalizeCase(
                currentUserId(
                        jwt
                ),
                caseId,
                input
        );
    }

    @PostMapping("/cases/{caseId}/reject")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SupplierOnboardingCaseResponse rejectCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            OnboardingDecisionInput input
    ) {
        return service.rejectCase(
                currentUserId(
                        jwt
                ),
                caseId,
                input
        );
    }

    @PostMapping("/cases/{caseId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SupplierOnboardingCaseResponse cancelCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            OnboardingDecisionInput input
    ) {
        return service.cancelCase(
                currentUserId(
                        jwt
                ),
                caseId,
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
