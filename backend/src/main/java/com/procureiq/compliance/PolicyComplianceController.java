package com.procureiq.compliance;

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
@RequestMapping("/api/v1/compliance")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class PolicyComplianceController {

    private final PolicyComplianceService service;

    public PolicyComplianceController(
            PolicyComplianceService service
    ) {
        this.service =
                service;
    }

    @GetMapping("/policies")
    public List<ProcurementPolicyResponse> policies(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.policies(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/policies")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public ProcurementPolicyResponse createPolicy(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            ProcurementPolicyInput input
    ) {
        return service.createPolicy(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PostMapping("/policies/{policyId}/activate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public ProcurementPolicyResponse activatePolicy(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID policyId
    ) {
        return service.activatePolicy(
                currentUserId(
                        jwt
                ),
                policyId
        );
    }

    @PostMapping("/policies/{policyId}/deactivate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public ProcurementPolicyResponse deactivatePolicy(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID policyId
    ) {
        return service.deactivatePolicy(
                currentUserId(
                        jwt
                ),
                policyId
        );
    }

    @PostMapping("/evaluate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public PolicyEvaluationResponse evaluate(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.evaluate(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/violations")
    public List<PolicyViolationResponse> violations(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.violations(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/violations/{violationId}")
    public PolicyViolationDetailResponse violationDetail(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID violationId
    ) {
        return service.violationDetail(
                currentUserId(
                        jwt
                ),
                violationId
        );
    }

    @PostMapping("/violations/{violationId}/waivers")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public PolicyWaiverResponse requestWaiver(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID violationId,

            @Valid
            @RequestBody
            PolicyWaiverInput input
    ) {
        return service.requestWaiver(
                currentUserId(
                        jwt
                ),
                violationId,
                input
        );
    }

    @PostMapping("/waivers/{waiverId}/approve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public PolicyWaiverResponse approveWaiver(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID waiverId,

            @Valid
            @RequestBody
            PolicyDecisionInput input
    ) {
        return service.approveWaiver(
                currentUserId(
                        jwt
                ),
                waiverId,
                input
        );
    }

    @PostMapping("/waivers/{waiverId}/reject")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public PolicyWaiverResponse rejectWaiver(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID waiverId,

            @Valid
            @RequestBody
            PolicyDecisionInput input
    ) {
        return service.rejectWaiver(
                currentUserId(
                        jwt
                ),
                waiverId,
                input
        );
    }

    @PostMapping("/violations/{violationId}/evidence")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public PolicyEvidenceResponse addEvidence(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID violationId,

            @Valid
            @RequestBody
            PolicyEvidenceInput input
    ) {
        return service.addEvidence(
                currentUserId(
                        jwt
                ),
                violationId,
                input
        );
    }

    @PostMapping("/violations/{violationId}/resolve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public PolicyViolationResponse resolveViolation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID violationId,

            @Valid
            @RequestBody
            PolicyDecisionInput input
    ) {
        return service.resolveViolation(
                currentUserId(
                        jwt
                ),
                violationId,
                input
        );
    }

    @GetMapping("/summary")
    public PolicyComplianceSummaryResponse summary(
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
    public PolicyComplianceContextResponse contextOptions(
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
