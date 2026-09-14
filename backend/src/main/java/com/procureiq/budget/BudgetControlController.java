package com.procureiq.budget;

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
@RequestMapping("/api/v1/budgets")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class BudgetControlController {

    private final BudgetControlService
            budgetControlService;

    public BudgetControlController(
            BudgetControlService budgetControlService
    ) {
        this.budgetControlService =
                budgetControlService;
    }

    @GetMapping
    public List<BudgetAllocationResponse>
    allocations(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            Integer fiscalYear,

            @RequestParam(required = false)
            String currency
    ) {
        return budgetControlService
                .allocations(
                        currentUserId(jwt),
                        fiscalYear,
                        currency
                );
    }

    @GetMapping("/usage")
    public List<BudgetUsageResponse> usage(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            Integer fiscalYear,

            @RequestParam(required = false)
            String currency
    ) {
        return budgetControlService
                .usage(
                        currentUserId(jwt),
                        fiscalYear,
                        currency
                );
    }

    @GetMapping("/summary")
    public BudgetSummaryResponse summary(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            Integer fiscalYear,

            @RequestParam(required = false)
            String currency
    ) {
        return budgetControlService
                .summary(
                        currentUserId(jwt),
                        fiscalYear,
                        currency
                );
    }

    @GetMapping("/alerts")
    public List<BudgetAlertResponse> alerts(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            Integer fiscalYear,

            @RequestParam(required = false)
            String currency
    ) {
        return budgetControlService
                .alerts(
                        currentUserId(jwt),
                        fiscalYear,
                        currency
                );
    }

    @GetMapping("/context-options")
    public BudgetContextOptionsResponse
    contextOptions(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return budgetControlService
                .contextOptions(
                        currentUserId(jwt)
                );
    }

    @GetMapping(
            "/check/purchase-requests/{requestId}"
    )
    public PurchaseRequestBudgetCheckResponse
    checkPurchaseRequest(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID requestId
    ) {
        return budgetControlService
                .checkPurchaseRequest(
                        currentUserId(jwt),
                        requestId
                );
    }

    @PostMapping
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public BudgetAllocationResponse create(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            BudgetAllocationInput input
    ) {
        return budgetControlService
                .create(
                        currentUserId(jwt),
                        input
                );
    }

    @PutMapping("/{allocationId}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public BudgetAllocationResponse update(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID allocationId,

            @Valid
            @RequestBody
            BudgetAllocationInput input
    ) {
        return budgetControlService
                .update(
                        currentUserId(jwt),
                        allocationId,
                        input
                );
    }

    @PostMapping("/{allocationId}/archive")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    @ResponseStatus(
            HttpStatus.NO_CONTENT
    )
    public void archive(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID allocationId
    ) {
        budgetControlService
                .archive(
                        currentUserId(jwt),
                        allocationId
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
