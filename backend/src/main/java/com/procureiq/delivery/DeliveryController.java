package com.procureiq.delivery;

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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
)
public class DeliveryController {

    private final DeliveryService deliveryService;

    private final SupplierDeliveryPerformanceService
            performanceService;

    public DeliveryController(
            DeliveryService deliveryService,
            SupplierDeliveryPerformanceService performanceService
    ) {
        this.deliveryService =
                deliveryService;

        this.performanceService =
                performanceService;
    }

    @GetMapping("/deliveries/summary")
    public DeliverySummaryResponse getSummary(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return deliveryService
                .getSummary(
                        currentUserId(jwt)
                );
    }

    @GetMapping(
            "/purchase-orders/{purchaseOrderId}/receiving"
    )
    public PurchaseOrderReceivingResponse
    getReceivingState(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID purchaseOrderId
    ) {
        return deliveryService
                .getReceivingState(
                        currentUserId(jwt),
                        purchaseOrderId
                );
    }

    @GetMapping(
            "/purchase-orders/{purchaseOrderId}/receipts"
    )
    public List<GoodsReceiptResponse> findReceipts(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID purchaseOrderId
    ) {
        return deliveryService
                .findReceipts(
                        currentUserId(jwt),
                        purchaseOrderId
                );
    }

    @PostMapping(
            "/purchase-orders/{purchaseOrderId}/receipts"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public GoodsReceiptResponse createReceipt(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID purchaseOrderId,

            @Valid
            @RequestBody
            GoodsReceiptInput input
    ) {
        return deliveryService
                .createReceipt(
                        currentUserId(jwt),
                        purchaseOrderId,
                        input
                );
    }

    @GetMapping(
            "/suppliers/{supplierId}/delivery-performance"
    )
    public SupplierDeliveryPerformanceResponse
    getSupplierPerformance(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID supplierId
    ) {
        currentUserId(jwt);

        return performanceService
                .find(
                        supplierId
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
