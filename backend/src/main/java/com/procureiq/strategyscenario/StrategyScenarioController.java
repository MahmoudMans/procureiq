package com.procureiq.strategyscenario;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Year;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/strategy-scenarios")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class StrategyScenarioController {

    private final StrategyScenarioService service;

    public StrategyScenarioController(
            StrategyScenarioService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public StrategyScenarioDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency,

            @RequestParam(
                    required = false
            )
            Integer fiscalYear
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                ),
                currency,
                fiscalYear == null
                        ? Year.now()
                                .getValue()
                        : fiscalYear
        );
    }

    @PostMapping
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public StrategyScenarioDetailResponse createScenario(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            StrategyScenarioInput input
    ) {
        return service.createScenario(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @GetMapping("/{scenarioId}")
    public StrategyScenarioDetailResponse scenario(
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

    @PutMapping("/{scenarioId}/assumptions")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public StrategyScenarioDetailResponse upsertAssumption(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID scenarioId,

            @Valid
            @RequestBody
            StrategyScenarioAssumptionInput input
    ) {
        return service.upsertAssumption(
                currentUserId(
                        jwt
                ),
                scenarioId,
                input
        );
    }

    @DeleteMapping("/assumptions/{assumptionId}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.NO_CONTENT
    )
    public void deleteAssumption(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID assumptionId
    ) {
        service.deleteAssumption(
                currentUserId(
                        jwt
                ),
                assumptionId
        );
    }

    @PostMapping("/{scenarioId}/evaluate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public StrategyScenarioEvaluationDetailResponse evaluate(
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

    @PostMapping("/{scenarioId}/approve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public StrategyScenarioDetailResponse approve(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID scenarioId,

            @Valid
            @RequestBody
            StrategyScenarioDecisionInput input
    ) {
        return service.approve(
                currentUserId(
                        jwt
                ),
                scenarioId,
                input
        );
    }

    @PostMapping("/{scenarioId}/archive")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public StrategyScenarioDetailResponse archive(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID scenarioId,

            @Valid
            @RequestBody
            StrategyScenarioDecisionInput input
    ) {
        return service.archive(
                currentUserId(
                        jwt
                ),
                scenarioId,
                input
        );
    }

    @GetMapping("/evaluations/{evaluationId}")
    public StrategyScenarioEvaluationDetailResponse evaluation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID evaluationId
    ) {
        return service.evaluation(
                currentUserId(
                        jwt
                ),
                evaluationId
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
