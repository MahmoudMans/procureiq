package com.procureiq.purchaserequest;

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
@RequestMapping(
        "/api/v1/purchase-requests"
)
public class PurchaseRequestController {

    private final PurchaseRequestService
            purchaseRequestService;

    public PurchaseRequestController(
            PurchaseRequestService
                    purchaseRequestService
    ) {
        this.purchaseRequestService =
                purchaseRequestService;
    }

    @GetMapping
    public List<PurchaseRequestResponse>
    findRequests(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            String query,

            @RequestParam(required = false)
            PurchaseRequestStatus status
    ) {
        return purchaseRequestService
                .findRequests(
                        currentUserId(jwt),
                        query,
                        status
                );
    }

    @GetMapping("/summary")
    public PurchaseRequestSummaryResponse
    getSummary(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return purchaseRequestService
                .getSummary(
                        currentUserId(jwt)
                );
    }

    @GetMapping("/{id}")
    public PurchaseRequestResponse
    findRequest(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID id
    ) {
        return purchaseRequestService
                .findRequest(
                        currentUserId(jwt),
                        id
                );
    }

    @PostMapping
    @ResponseStatus(
            HttpStatus.CREATED
    )
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','REQUESTER')"
    )
    public PurchaseRequestResponse
    createRequest(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            PurchaseRequestInput input
    ) {
        return purchaseRequestService
                .createRequest(
                        currentUserId(jwt),
                        input
                );
    }

    @PutMapping("/{id}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','REQUESTER')"
    )
    public PurchaseRequestResponse
    updateRequest(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID id,

            @Valid
            @RequestBody
            PurchaseRequestInput input
    ) {
        return purchaseRequestService
                .updateRequest(
                        currentUserId(jwt),
                        id,
                        input
                );
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','REQUESTER')"
    )
    public PurchaseRequestResponse
    submitRequest(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID id
    ) {
        return purchaseRequestService
                .submitRequest(
                        currentUserId(jwt),
                        id
                );
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','REQUESTER')"
    )
    public PurchaseRequestResponse
    cancelRequest(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID id
    ) {
        return purchaseRequestService
                .cancelRequest(
                        currentUserId(jwt),
                        id
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
