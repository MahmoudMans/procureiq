package com.procureiq.supplierresilience;

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
@RequestMapping("/api/v1/supplier-resilience")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class SupplierResilienceController {

    private final SupplierResilienceService service;

    public SupplierResilienceController(
            SupplierResilienceService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public List<SupplierResilienceIntelligenceResponse> intelligence(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.intelligence(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @GetMapping("/summary")
    public SupplierResilienceSummaryResponse summary(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.summary(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @GetMapping("/countries")
    public List<SupplierCountryConcentrationResponse> countries(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.countries(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @GetMapping("/suppliers/{supplierId}")
    public SupplierResilienceDetailResponse detail(
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

    @PostMapping("/suppliers/{supplierId}/profile")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SupplierResilienceDetailResponse upsertProfile(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID supplierId,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency,

            @Valid
            @RequestBody
            SupplierResilienceProfileInput input
    ) {
        return service.upsertProfile(
                currentUserId(
                        jwt
                ),
                supplierId,
                currency,
                input
        );
    }

    @PostMapping("/suppliers/{supplierId}/profile/deactivate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SupplierResilienceDetailResponse deactivateProfile(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID supplierId,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.deactivateProfile(
                currentUserId(
                        jwt
                ),
                supplierId,
                currency
        );
    }

    @PostMapping("/suppliers/{supplierId}/actions")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public ResilienceActionResponse createAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID supplierId,

            @Valid
            @RequestBody
            ResilienceActionInput input
    ) {
        return service.createAction(
                currentUserId(
                        jwt
                ),
                supplierId,
                input
        );
    }

    @PostMapping("/actions/{actionId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ResilienceActionResponse startAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId
    ) {
        return service.startAction(
                currentUserId(
                        jwt
                ),
                actionId
        );
    }

    @PostMapping("/actions/{actionId}/complete")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ResilienceActionResponse completeAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId,

            @Valid
            @RequestBody
            ResilienceActionCompletionInput input
    ) {
        return service.completeAction(
                currentUserId(
                        jwt
                ),
                actionId,
                input
        );
    }

    @PostMapping("/actions/{actionId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public ResilienceActionResponse cancelAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId
    ) {
        return service.cancelAction(
                currentUserId(
                        jwt
                ),
                actionId
        );
    }

    @GetMapping("/context-options")
    public SupplierResilienceContextResponse contextOptions(
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
