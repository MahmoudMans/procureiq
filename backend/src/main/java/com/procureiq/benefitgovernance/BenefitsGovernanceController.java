package com.procureiq.benefitgovernance;

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
@RequestMapping("/api/v1/benefits-governance")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class BenefitsGovernanceController {

    private final BenefitsGovernanceService service;

    public BenefitsGovernanceController(
            BenefitsGovernanceService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public BenefitsGovernanceDashboardResponse dashboard(
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
    public BenefitsGovernanceContextResponse contextOptions(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.contextOptions(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/portfolios/{portfolioId}")
    public ExecutionPortfolioDetailResponse portfolio(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID portfolioId
    ) {
        return service.portfolio(
                currentUserId(
                        jwt
                ),
                portfolioId
        );
    }

    @PostMapping("/scenarios/{scenarioId}/authorize")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public ExecutionPortfolioDetailResponse authorizeScenario(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID scenarioId,

            @Valid
            @RequestBody
            ExecutionPortfolioAuthorizationInput input
    ) {
        return service.authorizeScenario(
                currentUserId(
                        jwt
                ),
                scenarioId,
                input
        );
    }

    @PostMapping("/portfolios/{portfolioId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ExecutionPortfolioSummaryResponse startPortfolio(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID portfolioId
    ) {
        return service.startPortfolio(
                currentUserId(
                        jwt
                ),
                portfolioId
        );
    }

    @PostMapping("/portfolios/{portfolioId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public ExecutionPortfolioSummaryResponse closePortfolio(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID portfolioId
    ) {
        return service.closePortfolio(
                currentUserId(
                        jwt
                ),
                portfolioId
        );
    }

    @PostMapping("/portfolios/{portfolioId}/archive")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public ExecutionPortfolioSummaryResponse archivePortfolio(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID portfolioId
    ) {
        return service.archivePortfolio(
                currentUserId(
                        jwt
                ),
                portfolioId
        );
    }

    @PutMapping("/items/{itemId}/owner")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public BenefitItemResponse reassignBenefitOwner(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId,

            @Valid
            @RequestBody
            BenefitOwnerInput input
    ) {
        return service.reassignBenefitOwner(
                currentUserId(
                        jwt
                ),
                itemId,
                input
        );
    }

    @PostMapping("/items/{itemId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public BenefitItemResponse startBenefitItem(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId
    ) {
        return service.startBenefitItem(
                currentUserId(
                        jwt
                ),
                itemId
        );
    }

    @PutMapping("/items/{itemId}/forecast")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public BenefitItemResponse updateForecast(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId,

            @Valid
            @RequestBody
            BenefitForecastInput input
    ) {
        return service.updateForecast(
                currentUserId(
                        jwt
                ),
                itemId,
                input
        );
    }

    @PostMapping("/items/{itemId}/validation-request")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public BenefitItemResponse requestValidation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId,

            @Valid
            @RequestBody
            BenefitValidationRequestInput input
    ) {
        return service.requestValidation(
                currentUserId(
                        jwt
                ),
                itemId,
                input
        );
    }

    @PostMapping("/items/{itemId}/validate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public BenefitItemResponse validateBenefit(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId,

            @Valid
            @RequestBody
            BenefitValidationDecisionInput input
    ) {
        return service.validateBenefit(
                currentUserId(
                        jwt
                ),
                itemId,
                input
        );
    }

    @PostMapping("/items/{itemId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public BenefitItemResponse cancelBenefitItem(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId
    ) {
        return service.cancelBenefitItem(
                currentUserId(
                        jwt
                ),
                itemId
        );
    }

    @PostMapping("/portfolios/{portfolioId}/assumptions")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public BenefitAssumptionResponse createAssumption(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID portfolioId,

            @Valid
            @RequestBody
            BenefitAssumptionInput input
    ) {
        return service.createAssumption(
                currentUserId(
                        jwt
                ),
                portfolioId,
                input
        );
    }

    @PostMapping("/assumptions/{assumptionId}/confirm")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public BenefitAssumptionResponse confirmAssumption(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID assumptionId,

            @Valid
            @RequestBody
            BenefitResolutionInput input
    ) {
        return service.confirmAssumption(
                currentUserId(
                        jwt
                ),
                assumptionId,
                input
        );
    }

    @PostMapping("/assumptions/{assumptionId}/invalidate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public BenefitAssumptionResponse invalidateAssumption(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID assumptionId,

            @Valid
            @RequestBody
            BenefitResolutionInput input
    ) {
        return service.invalidateAssumption(
                currentUserId(
                        jwt
                ),
                assumptionId,
                input
        );
    }

    @PostMapping("/items/{itemId}/leakage")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public BenefitLeakageResponse createLeakage(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId,

            @Valid
            @RequestBody
            BenefitLeakageInput input
    ) {
        return service.createLeakage(
                currentUserId(
                        jwt
                ),
                itemId,
                input
        );
    }

    @PostMapping("/leakage/{leakageId}/resolve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public BenefitLeakageResponse resolveLeakage(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID leakageId,

            @Valid
            @RequestBody
            BenefitLeakageResolutionInput input
    ) {
        return service.resolveLeakage(
                currentUserId(
                        jwt
                ),
                leakageId,
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
