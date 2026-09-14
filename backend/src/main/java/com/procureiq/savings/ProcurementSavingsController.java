package com.procureiq.savings;

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
@RequestMapping("/api/v1/savings")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class ProcurementSavingsController {

    private final ProcurementSavingsService service;

    public ProcurementSavingsController(
            ProcurementSavingsService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public List<SavingsInitiativeResponse> initiatives(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            Integer fiscalYear,

            @RequestParam(required = false)
            String currency
    ) {
        return service.initiatives(
                currentUserId(jwt),
                fiscalYear,
                currency
        );
    }

    @GetMapping("/summary")
    public SavingsSummaryResponse summary(
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

    @GetMapping("/monthly")
    public List<SavingsMonthlyResponse> monthly(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            Integer fiscalYear,

            @RequestParam(required = false)
            String currency
    ) {
        return service.monthly(
                currentUserId(jwt),
                fiscalYear,
                currency
        );
    }

    @GetMapping("/supplier-attribution")
    public List<SavingsAttributionResponse>
    supplierAttribution(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            Integer fiscalYear,

            @RequestParam(required = false)
            String currency
    ) {
        return service.supplierAttribution(
                currentUserId(jwt),
                fiscalYear,
                currency
        );
    }

    @GetMapping("/category-attribution")
    public List<SavingsAttributionResponse>
    categoryAttribution(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            Integer fiscalYear,

            @RequestParam(required = false)
            String currency
    ) {
        return service.categoryAttribution(
                currentUserId(jwt),
                fiscalYear,
                currency
        );
    }

    @GetMapping("/context-options")
    public SavingsContextOptionsResponse
    contextOptions(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.contextOptions(
                currentUserId(jwt)
        );
    }

    @GetMapping("/{initiativeId}")
    public SavingsInitiativeResponse find(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId
    ) {
        return service.find(
                currentUserId(jwt),
                initiativeId
        );
    }

    @PostMapping
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public SavingsInitiativeResponse create(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            SavingsInitiativeInput input
    ) {
        return service.create(
                currentUserId(jwt),
                input
        );
    }

    @PostMapping("/{initiativeId}/submit")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SavingsInitiativeResponse submit(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId
    ) {
        return service.submit(
                currentUserId(jwt),
                initiativeId
        );
    }

    @PostMapping("/{initiativeId}/validate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SavingsInitiativeResponse validate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId,

            @Valid
            @RequestBody
            SavingsDecisionInput input
    ) {
        return service.validate(
                currentUserId(jwt),
                initiativeId,
                input
        );
    }

    @PostMapping("/{initiativeId}/reject")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SavingsInitiativeResponse reject(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId,

            @Valid
            @RequestBody
            SavingsDecisionInput input
    ) {
        return service.reject(
                currentUserId(jwt),
                initiativeId,
                input
        );
    }

    @PostMapping("/{initiativeId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SavingsInitiativeResponse close(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId
    ) {
        return service.close(
                currentUserId(jwt),
                initiativeId
        );
    }

    @PostMapping("/{initiativeId}/realizations")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public SavingsRealizationResponse
    addRealization(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId,

            @Valid
            @RequestBody
            SavingsRealizationInput input
    ) {
        return service.addRealization(
                currentUserId(jwt),
                initiativeId,
                input
        );
    }

    @PostMapping("/discover")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SavingsDiscoveryResponse discover(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.discover(
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
