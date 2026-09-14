package com.procureiq.executive;

import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/executive-cockpit")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class ExecutiveCockpitController {

    private final ExecutiveCockpitService service;

    public ExecutiveCockpitController(
            ExecutiveCockpitService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public ExecutiveCockpitResponse cockpit(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.cockpit(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @PostMapping("/warnings/{warningKey}/acknowledge")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ExecutiveWarningResponse acknowledgeWarning(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            String warningKey,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency,

            @Valid
            @RequestBody
            ExecutiveWarningAcknowledgeInput input
    ) {
        return service.acknowledgeWarning(
                currentUserId(
                        jwt
                ),
                warningKey,
                input,
                currency
        );
    }

    @DeleteMapping("/warnings/{warningKey}/acknowledge")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public void unacknowledgeWarning(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            String warningKey
    ) {
        service.unacknowledgeWarning(
                currentUserId(
                        jwt
                ),
                warningKey
        );
    }

    @PutMapping("/rules/{ruleId}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public ExecutiveRuleResponse updateRule(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            long ruleId,

            @Valid
            @RequestBody
            ExecutiveRuleUpdateInput input
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
