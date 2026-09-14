package com.procureiq.suppliermonitoring;

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
@RequestMapping("/api/v1/supplier-risk-monitoring")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class SupplierRiskMonitoringController {

    private final SupplierRiskMonitoringService service;

    public SupplierRiskMonitoringController(
            SupplierRiskMonitoringService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public SupplierRiskDashboardResponse dashboard(
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

    @PostMapping("/evaluate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SupplierRiskEvaluationRunResponse evaluate(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.evaluatePortfolio(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @GetMapping("/context-options")
    public SupplierRiskContextResponse contextOptions(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.contextOptions(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/suppliers/{supplierId}")
    public SupplierRiskDetailResponse detail(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID supplierId,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.detail(
                currentUserId(
                        jwt
                ),
                supplierId,
                currency
        );
    }

    @PostMapping("/suppliers/{supplierId}/watchlist")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SupplierRiskWatchlistResponse addWatchlist(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID supplierId,

            @Valid
            @RequestBody
            SupplierRiskWatchlistInput input
    ) {
        return service.addWatchlist(
                currentUserId(
                        jwt
                ),
                supplierId,
                input
        );
    }

    @PostMapping("/suppliers/{supplierId}/watchlist/release")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.NO_CONTENT
    )
    public void releaseWatchlist(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID supplierId,

            @Valid
            @RequestBody
            SupplierRiskWatchlistInput input
    ) {
        service.releaseWatchlist(
                currentUserId(
                        jwt
                ),
                supplierId,
                input
        );
    }

    @PostMapping("/alerts/{alertId}/acknowledge")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SupplierRiskAlertResponse acknowledgeAlert(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID alertId,

            @Valid
            @RequestBody
            SupplierRiskAlertAcknowledgeInput input
    ) {
        return service.acknowledgeAlert(
                currentUserId(
                        jwt
                ),
                alertId,
                input
        );
    }

    @PostMapping("/suppliers/{supplierId}/escalations")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public SupplierRiskEscalationResponse createEscalation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID supplierId,

            @Valid
            @RequestBody
            SupplierRiskEscalationInput input
    ) {
        return service.createEscalation(
                currentUserId(
                        jwt
                ),
                supplierId,
                input
        );
    }

    @PostMapping("/escalations/{caseId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SupplierRiskEscalationResponse startEscalation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId
    ) {
        return service.startEscalation(
                currentUserId(
                        jwt
                ),
                caseId
        );
    }

    @PostMapping("/escalations/{caseId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SupplierRiskEscalationResponse closeEscalation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            SupplierRiskEscalationCloseInput input
    ) {
        return service.closeEscalation(
                currentUserId(
                        jwt
                ),
                caseId,
                input
        );
    }

    @PostMapping("/escalations/{caseId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SupplierRiskEscalationResponse cancelEscalation(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            SupplierRiskEscalationCloseInput input
    ) {
        return service.cancelEscalation(
                currentUserId(
                        jwt
                ),
                caseId,
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
