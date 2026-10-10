package com.procureiq.supplierportal;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Supplier self-service on purchase orders. Like the rest of /api/v1/supplier-portal, access is
 * decided by the portal session token, not by a staff JWT.
 */
@RestController
@RequestMapping("/api/v1/supplier-portal/purchase-orders")
public class SupplierPortalPurchaseOrderController {

    private final SupplierPortalPurchaseOrderService service;

    public SupplierPortalPurchaseOrderController(
            SupplierPortalPurchaseOrderService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public List<SupplierPortalPurchaseOrderSummaryResponse> purchaseOrders(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization
    ) {
        return service.purchaseOrders(
                bearerToken(
                        authorization
                )
        );
    }

    @GetMapping("/{purchaseOrderId}")
    public SupplierPortalPurchaseOrderDetailResponse purchaseOrder(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization,

            @PathVariable
            UUID purchaseOrderId
    ) {
        return service.purchaseOrder(
                bearerToken(
                        authorization
                ),
                purchaseOrderId
        );
    }

    @PostMapping("/{purchaseOrderId}/acknowledge")
    public SupplierPortalPurchaseOrderDetailResponse acknowledge(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization,

            @PathVariable
            UUID purchaseOrderId,

            @Valid
            @RequestBody(
                    required = false
            )
            SupplierPortalPurchaseOrderResponseInput input
    ) {
        return service.acknowledge(
                bearerToken(
                        authorization
                ),
                purchaseOrderId,
                input == null
                        ? null
                        : input.note()
        );
    }

    @PostMapping("/{purchaseOrderId}/reject")
    public SupplierPortalPurchaseOrderDetailResponse reject(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization,

            @PathVariable
            UUID purchaseOrderId,

            @Valid
            @RequestBody
            SupplierPortalPurchaseOrderResponseInput input
    ) {
        return service.reject(
                bearerToken(
                        authorization
                ),
                purchaseOrderId,
                input.note()
        );
    }

    private String bearerToken(
            String authorization
    ) {
        if (
                authorization == null
                ||
                !authorization.startsWith(
                        "Bearer "
                )
        ) {
            throw new IllegalArgumentException(
                    "Supplier portal bearer token is required."
            );
        }

        String token =
                authorization
                        .substring(
                                7
                        )
                        .trim();

        if (token.isEmpty()) {
            throw new IllegalArgumentException(
                    "Supplier portal bearer token is required."
            );
        }

        return token;
    }
}
