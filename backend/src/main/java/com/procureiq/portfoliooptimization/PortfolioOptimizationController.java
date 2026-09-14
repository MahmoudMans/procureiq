package com.procureiq.portfoliooptimization;

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

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/portfolio-optimization")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class PortfolioOptimizationController {

    private final PortfolioOptimizationService service;

    public PortfolioOptimizationController(
            PortfolioOptimizationService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public PortfolioOptimizationDashboardResponse dashboard(
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

    @GetMapping("/context-options")
    public PortfolioOptimizationContextResponse contextOptions(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.contextOptions(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/scenarios/{scenarioId}")
    public PortfolioScenarioDetailResponse scenario(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID scenarioId
    ) {
        return service.scenario(
                currentUserId(
                        jwt
                ),
                scenarioId
        );
    }

    @PostMapping("/scenarios")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public PortfolioScenarioDetailResponse createScenario(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            PortfolioScenarioInput input
    ) {
        return service.createScenario(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PostMapping("/scenarios/{scenarioId}/evaluate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public PortfolioOptimizationRunResponse evaluate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID scenarioId
    ) {
        return service.evaluate(
                currentUserId(
                        jwt
                ),
                scenarioId
        );
    }

    @PostMapping("/scenarios/{scenarioId}/approve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public PortfolioScenarioSummaryResponse approve(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID scenarioId
    ) {
        return service.approve(
                currentUserId(
                        jwt
                ),
                scenarioId
        );
    }

    @PostMapping("/scenarios/{scenarioId}/archive")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public PortfolioScenarioSummaryResponse archive(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID scenarioId
    ) {
        return service.archive(
                currentUserId(
                        jwt
                ),
                scenarioId
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
