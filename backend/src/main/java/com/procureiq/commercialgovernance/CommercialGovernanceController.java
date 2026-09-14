package com.procureiq.commercialgovernance;

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
@RequestMapping("/api/v1/commercial-governance")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class CommercialGovernanceController {

    private final CommercialGovernanceService service;

    public CommercialGovernanceController(
            CommercialGovernanceService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public List<CommercialGovernanceRecordResponse> governanceRecords(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.governanceRecords(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @GetMapping("/{governanceId}")
    public CommercialGovernanceDetailResponse detail(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID governanceId
    ) {
        return service.detail(
                currentUserId(
                        jwt
                ),
                governanceId
        );
    }

    @PostMapping
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CommercialGovernanceDetailResponse createGovernance(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            CommercialGovernanceInput input
    ) {
        return service.createGovernance(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PostMapping("/{governanceId}/renewal/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CommercialGovernanceRecordResponse startRenewalReview(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID governanceId
    ) {
        return service.startRenewalReview(
                currentUserId(
                        jwt
                ),
                governanceId
        );
    }

    @PostMapping("/{governanceId}/renewal/decision")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public CommercialGovernanceRecordResponse decideRenewal(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID governanceId,

            @Valid
            @RequestBody
            ContractRenewalDecisionInput input
    ) {
        return service.decideRenewal(
                currentUserId(
                        jwt
                ),
                governanceId,
                input
        );
    }

    @PostMapping("/{governanceId}/renewal/complete")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CommercialGovernanceRecordResponse completeRenewal(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID governanceId
    ) {
        return service.completeRenewal(
                currentUserId(
                        jwt
                ),
                governanceId
        );
    }

    @PostMapping("/{governanceId}/deactivate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public CommercialGovernanceRecordResponse deactivateGovernance(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID governanceId
    ) {
        return service.deactivateGovernance(
                currentUserId(
                        jwt
                ),
                governanceId
        );
    }

    @PostMapping("/{governanceId}/obligations")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public ContractObligationResponse createObligation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID governanceId,

            @Valid
            @RequestBody
            ContractObligationInput input
    ) {
        return service.createObligation(
                currentUserId(
                        jwt
                ),
                governanceId,
                input
        );
    }

    @PostMapping("/obligations/{obligationId}/complete")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ContractObligationResponse completeObligation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID obligationId,

            @Valid
            @RequestBody
            ContractObligationCompletionInput input
    ) {
        return service.completeObligation(
                currentUserId(
                        jwt
                ),
                obligationId,
                input
        );
    }

    @PostMapping("/obligations/{obligationId}/waive")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public ContractObligationResponse waiveObligation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID obligationId,

            @Valid
            @RequestBody
            ContractObligationCompletionInput input
    ) {
        return service.waiveObligation(
                currentUserId(
                        jwt
                ),
                obligationId,
                input
        );
    }

    @PostMapping("/leakage/discover")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CommercialLeakageDiscoveryResponse discoverLeakage(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.discoverLeakage(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @GetMapping("/leakage/findings")
    public List<CommercialLeakageFindingResponse> leakageFindings(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.leakageFindings(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @PostMapping("/leakage/{findingId}/resolve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CommercialLeakageFindingResponse resolveLeakage(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID findingId,

            @Valid
            @RequestBody
            CommercialLeakageDecisionInput input
    ) {
        return service.resolveLeakage(
                currentUserId(
                        jwt
                ),
                findingId,
                input
        );
    }

    @PostMapping("/leakage/{findingId}/dismiss")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public CommercialLeakageFindingResponse dismissLeakage(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID findingId,

            @Valid
            @RequestBody
            CommercialLeakageDecisionInput input
    ) {
        return service.dismissLeakage(
                currentUserId(
                        jwt
                ),
                findingId,
                input
        );
    }

    @GetMapping("/summary")
    public CommercialGovernanceSummaryResponse summary(
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

    @GetMapping("/context-options")
    public CommercialGovernanceContextResponse contextOptions(
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
