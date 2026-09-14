package com.procureiq.risk;

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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/risks")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class ProcurementRiskController {

    private final ProcurementRiskService
            riskService;

    public ProcurementRiskController(
            ProcurementRiskService riskService
    ) {
        this.riskService =
                riskService;
    }

    @GetMapping
    public List<RiskCaseResponse> findCases(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            String query,

            @RequestParam(required = false)
            RiskCaseStatus status,

            @RequestParam(required = false)
            RiskSeverity severity,

            @RequestParam(required = false)
            RiskCategory category
    ) {
        return riskService
                .findCases(
                        currentUserId(jwt),
                        query,
                        status,
                        severity,
                        category
                );
    }

    @GetMapping("/summary")
    public RiskSummaryResponse summary(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return riskService
                .summary(
                        currentUserId(jwt)
                );
    }

    @GetMapping("/context-options")
    public RiskContextOptionsResponse
    contextOptions(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return riskService
                .contextOptions(
                        currentUserId(jwt)
                );
    }

    @GetMapping("/{riskId}")
    public RiskCaseResponse findCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID riskId
    ) {
        return riskService
                .findCase(
                        currentUserId(jwt),
                        riskId
                );
    }

    @PostMapping
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public RiskCaseResponse createCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            RiskCaseCreateInput input
    ) {
        return riskService
                .createCase(
                        currentUserId(jwt),
                        input
                );
    }

    @PutMapping("/{riskId}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public RiskCaseResponse updateCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID riskId,

            @Valid
            @RequestBody
            RiskCaseUpdateInput input
    ) {
        return riskService
                .updateCase(
                        currentUserId(jwt),
                        riskId,
                        input
                );
    }

    @PostMapping("/{riskId}/start-mitigation")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public RiskCaseResponse startMitigation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID riskId
    ) {
        return riskService
                .startMitigation(
                        currentUserId(jwt),
                        riskId
                );
    }

    @PostMapping("/{riskId}/escalate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public RiskCaseResponse escalate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID riskId
    ) {
        return riskService
                .escalate(
                        currentUserId(jwt),
                        riskId
                );
    }

    @PostMapping("/{riskId}/resolve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public RiskCaseResponse resolve(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID riskId,

            @Valid
            @RequestBody
            RiskResolutionInput input
    ) {
        return riskService
                .resolve(
                        currentUserId(jwt),
                        riskId,
                        input
                );
    }

    @PostMapping("/{riskId}/accept")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public RiskCaseResponse accept(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID riskId,

            @Valid
            @RequestBody
            RiskResolutionInput input
    ) {
        return riskService
                .accept(
                        currentUserId(jwt),
                        riskId,
                        input
                );
    }

    @PostMapping("/{riskId}/mitigation-actions")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public RiskMitigationActionResponse
    addMitigationAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID riskId,

            @Valid
            @RequestBody
            RiskMitigationActionInput input
    ) {
        return riskService
                .addMitigationAction(
                        currentUserId(jwt),
                        riskId,
                        input
                );
    }

    @PostMapping(
            "/mitigation-actions/{actionId}/complete"
    )
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public RiskMitigationActionResponse
    completeMitigationAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId
    ) {
        return riskService
                .completeMitigationAction(
                        currentUserId(jwt),
                        actionId
                );
    }

    @PostMapping("/refresh-system-exceptions")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SystemRiskRefreshResponse
    refreshSystemExceptions(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return riskService
                .refreshSystemExceptions(
                        currentUserId(jwt)
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
