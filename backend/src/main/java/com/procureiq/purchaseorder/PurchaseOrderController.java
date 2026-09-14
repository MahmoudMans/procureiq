package com.procureiq.purchaseorder;

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
@RequestMapping("/api/v1/purchase-orders")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
)
public class PurchaseOrderController {

    private final PurchaseOrderService
            purchaseOrderService;

    public PurchaseOrderController(
            PurchaseOrderService purchaseOrderService
    ) {
        this.purchaseOrderService =
                purchaseOrderService;
    }

    @GetMapping
    public List<PurchaseOrderResponse> findOrders(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            String query,

            @RequestParam(required = false)
            PurchaseOrderStatus status
    ) {
        return purchaseOrderService
                .findOrders(
                        currentUserId(jwt),
                        query,
                        status
                );
    }

    @GetMapping("/summary")
    public PurchaseOrderSummaryResponse getSummary(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return purchaseOrderService
                .getSummary(
                        currentUserId(jwt)
                );
    }

    @GetMapping("/{id}")
    public PurchaseOrderResponse findOrder(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID id
    ) {
        return purchaseOrderService
                .findOrder(
                        currentUserId(jwt),
                        id
                );
    }

    @PostMapping
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public PurchaseOrderResponse createOrder(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            PurchaseOrderCreateInput input
    ) {
        return purchaseOrderService
                .createOrder(
                        currentUserId(jwt),
                        input
                );
    }

    @PutMapping("/{id}")
    public PurchaseOrderResponse updateOrder(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID id,

            @Valid
            @RequestBody
            PurchaseOrderUpdateInput input
    ) {
        return purchaseOrderService
                .updateOrder(
                        currentUserId(jwt),
                        id,
                        input
                );
    }

    @PostMapping("/{id}/issue")
    public PurchaseOrderResponse issueOrder(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID id
    ) {
        return purchaseOrderService
                .issueOrder(
                        currentUserId(jwt),
                        id
                );
    }

    @PostMapping("/{id}/cancel")
    public PurchaseOrderResponse cancelOrder(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID id
    ) {
        return purchaseOrderService
                .cancelOrder(
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
