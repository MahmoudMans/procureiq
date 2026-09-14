package com.procureiq.planning;

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
@RequestMapping("/api/v1/planning")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class ProcurementPlanningController {

    private final ProcurementPlanningService
            service;

    public ProcurementPlanningController(
            ProcurementPlanningService service
    ) {
        this.service =
                service;
    }

    @GetMapping("/plans")
    public List<ProcurementPlanResponse> plans(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            Integer fiscalYear,

            @RequestParam(required = false)
            String currency
    ) {
        return service.plans(
                currentUserId(jwt),
                fiscalYear,
                currency
        );
    }

    @GetMapping("/plans/{planId}")
    public ProcurementPlanDetailResponse plan(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID planId
    ) {
        return service.detail(
                currentUserId(jwt),
                planId
        );
    }

    @PostMapping("/plans")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public ProcurementPlanResponse createPlan(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            ProcurementPlanInput input
    ) {
        return service.createPlan(
                currentUserId(jwt),
                input
        );
    }

    @PostMapping("/plans/{planId}/activate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ProcurementPlanResponse activatePlan(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID planId
    ) {
        return service.activatePlan(
                currentUserId(jwt),
                planId
        );
    }

    @PostMapping("/plans/{planId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ProcurementPlanResponse closePlan(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID planId
    ) {
        return service.closePlan(
                currentUserId(jwt),
                planId
        );
    }

    @PostMapping("/plans/{planId}/items")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public ProcurementPlanItemResponse addItem(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID planId,

            @Valid
            @RequestBody
            ProcurementPlanItemInput input
    ) {
        return service.addItem(
                currentUserId(jwt),
                planId,
                input
        );
    }

    @PostMapping("/items/{itemId}/ready")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ProcurementPlanItemResponse ready(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId
    ) {
        return service.markReady(
                currentUserId(jwt),
                itemId
        );
    }

    @PostMapping("/items/{itemId}/link-request")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ProcurementPlanItemResponse linkRequest(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId,

            @Valid
            @RequestBody
            PlanRequestLinkInput input
    ) {
        return service.linkRequest(
                currentUserId(jwt),
                itemId,
                input
        );
    }

    @PostMapping("/items/{itemId}/complete")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ProcurementPlanItemResponse completeItem(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId
    ) {
        return service.completeItem(
                currentUserId(jwt),
                itemId
        );
    }

    @PostMapping("/items/{itemId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ProcurementPlanItemResponse cancelItem(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId
    ) {
        return service.cancelItem(
                currentUserId(jwt),
                itemId
        );
    }

    @GetMapping("/summary")
    public PlanningSummaryResponse summary(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            Integer fiscalYear,

            @RequestParam(required = false)
            String currency
    ) {
        return service.summary(
                currentUserId(jwt),
                fiscalYear,
                currency
        );
    }

    @GetMapping("/monthly-forecast")
    public List<PlanningMonthlyForecastResponse>
    monthlyForecast(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            Integer fiscalYear,

            @RequestParam(required = false)
            String currency
    ) {
        return service.monthlyForecast(
                currentUserId(jwt),
                fiscalYear,
                currency
        );
    }

    @GetMapping("/category-variance")
    public List<PlanningCategoryVarianceResponse>
    categoryVariance(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            Integer fiscalYear,

            @RequestParam(required = false)
            String currency
    ) {
        return service.categoryVariance(
                currentUserId(jwt),
                fiscalYear,
                currency
        );
    }

    @GetMapping("/upcoming-demand")
    public List<PlanningUpcomingDemandResponse>
    upcomingDemand(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            Integer fiscalYear,

            @RequestParam(required = false)
            String currency
    ) {
        return service.upcomingDemand(
                currentUserId(jwt),
                fiscalYear,
                currency
        );
    }

    @GetMapping("/context-options")
    public PlanningContextOptionsResponse
    contextOptions(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.contextOptions(
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
