package com.procureiq.dataquality;

import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/data-quality")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class DataQualityController {

    private final DataQualityService service;

    public DataQualityController(
            DataQualityService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public DataQualityDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/scan")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public DataQualityScanResponse scan(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.scan(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/findings/{findingId}")
    public DataQualityFindingDetailResponse finding(
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

    @PostMapping("/findings/{findingId}/resolve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public DataQualityFindingResponse resolveFinding(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID findingId,

            @Valid
            @RequestBody
            DataQualityFindingDecisionInput input
    ) {
        return service.resolveFinding(
                currentUserId(
                        jwt
                ),
                findingId,
                input
        );
    }

    @PostMapping("/findings/{findingId}/dismiss")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public DataQualityFindingResponse dismissFinding(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID findingId,

            @Valid
            @RequestBody
            DataQualityFindingDecisionInput input
    ) {
        return service.dismissFinding(
                currentUserId(
                        jwt
                ),
                findingId,
                input
        );
    }

    @PostMapping("/findings/{findingId}/remediations")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public DataQualityRemediationResponse createRemediation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID findingId,

            @Valid
            @RequestBody
            DataQualityRemediationInput input
    ) {
        return service.createRemediation(
                currentUserId(
                        jwt
                ),
                findingId,
                input
        );
    }

    @PostMapping("/remediations/{taskId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public DataQualityRemediationResponse startRemediation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID taskId
    ) {
        return service.startRemediation(
                currentUserId(
                        jwt
                ),
                taskId
        );
    }

    @PostMapping("/remediations/{taskId}/complete")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public DataQualityRemediationResponse completeRemediation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID taskId,

            @Valid
            @RequestBody
            DataQualityRemediationCompletionInput input
    ) {
        return service.completeRemediation(
                currentUserId(
                        jwt
                ),
                taskId,
                input
        );
    }

    @PostMapping("/remediations/{taskId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public DataQualityRemediationResponse cancelRemediation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID taskId
    ) {
        return service.cancelRemediation(
                currentUserId(
                        jwt
                ),
                taskId
        );
    }

    @PutMapping("/rules/{ruleId}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public DataQualityRuleResponse updateRule(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            long ruleId,

            @Valid
            @RequestBody
            DataQualityRuleUpdateInput input
    ) {
        return service.updateRule(
                currentUserId(
                        jwt
                ),
                ruleId,
                input
        );
    }

    @GetMapping("/context-options")
    public DataQualityContextResponse contextOptions(
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
