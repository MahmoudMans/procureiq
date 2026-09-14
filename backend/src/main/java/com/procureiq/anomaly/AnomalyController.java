package com.procureiq.anomaly;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/anomaly-control")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class AnomalyController {

    private final AnomalyService service;

    public AnomalyController(
            AnomalyService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public AnomalyControlDashboardResponse dashboard(
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

    @PostMapping("/scan")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public AnomalyScanResponse scan(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.scan(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @GetMapping("/context-options")
    public AnomalyContextResponse contextOptions(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.contextOptions(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/findings/{findingId}")
    public AnomalyFindingDetailResponse finding(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID findingId
    ) {
        return service.finding(
                currentUserId(
                        jwt
                ),
                findingId
        );
    }

    @PostMapping("/findings/{findingId}/investigations")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public InvestigationResponse createInvestigation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID findingId,

            @Valid
            @RequestBody
            InvestigationCreateInput input
    ) {
        return service.createInvestigation(
                currentUserId(
                        jwt
                ),
                findingId,
                input
        );
    }

    @PostMapping("/investigations/{investigationId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public InvestigationResponse startInvestigation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID investigationId
    ) {
        return service.startInvestigation(
                currentUserId(
                        jwt
                ),
                investigationId
        );
    }

    @PostMapping("/investigations/{investigationId}/evidence")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public InvestigationEvidenceResponse addEvidence(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID investigationId,

            @Valid
            @RequestBody
            InvestigationEvidenceInput input
    ) {
        return service.addEvidence(
                currentUserId(
                        jwt
                ),
                investigationId,
                input
        );
    }

    @PostMapping("/investigations/{investigationId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public InvestigationResponse closeInvestigation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID investigationId,

            @Valid
            @RequestBody
            InvestigationCloseInput input
    ) {
        return service.closeInvestigation(
                currentUserId(
                        jwt
                ),
                investigationId,
                input
        );
    }

    @PostMapping("/investigations/{investigationId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public InvestigationResponse cancelInvestigation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID investigationId,

            @Valid
            @RequestBody
            InvestigationCloseInput input
    ) {
        return service.cancelInvestigation(
                currentUserId(
                        jwt
                ),
                investigationId,
                input
        );
    }

    @PutMapping("/rules/{ruleId}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public AnomalyRuleResponse updateRule(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            long ruleId,

            @Valid
            @RequestBody
            AnomalyRuleUpdateInput input
    ) {
        return service.updateRule(
                currentUserId(
                        jwt
                ),
                ruleId,
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
