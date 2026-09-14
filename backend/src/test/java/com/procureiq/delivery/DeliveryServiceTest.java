package com.procureiq.delivery;

import com.procureiq.purchaseorder.PurchaseOrderEntity;
import com.procureiq.purchaseorder.PurchaseOrderLineEntity;
import com.procureiq.purchaseorder.PurchaseOrderRepository;
import com.procureiq.purchaseorder.PurchaseOrderStatus;
import com.procureiq.supplier.SupplierEntity;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DeliveryServiceTest {

    private GoodsReceiptRepository
            goodsReceiptRepository;

    private GoodsReceiptLineRepository
            goodsReceiptLineRepository;

    private PurchaseOrderRepository
            purchaseOrderRepository;

    private AppUserRepository
            appUserRepository;

    private SupplierDeliveryPerformanceService
            performanceService;

    private DeliveryService deliveryService;

    private UUID userId;
    private UUID orderId;
    private UUID lineId;

    private AppUserEntity buyer;
    private PurchaseOrderEntity order;
    private PurchaseOrderLineEntity line;
    private SupplierEntity supplier;

    @BeforeEach
    void setUp() {
        goodsReceiptRepository =
                mock(
                        GoodsReceiptRepository.class
                );

        goodsReceiptLineRepository =
                mock(
                        GoodsReceiptLineRepository.class
                );

        purchaseOrderRepository =
                mock(
                        PurchaseOrderRepository.class
                );

        appUserRepository =
                mock(
                        AppUserRepository.class
                );

        performanceService =
                mock(
                        SupplierDeliveryPerformanceService.class
                );

        deliveryService =
                new DeliveryService(
                        goodsReceiptRepository,
                        goodsReceiptLineRepository,
                        purchaseOrderRepository,
                        appUserRepository,
                        performanceService
                );

        userId =
                UUID.randomUUID();

        orderId =
                UUID.randomUUID();

        lineId =
                UUID.randomUUID();

        buyer =
                mock(
                        AppUserEntity.class
                );

        order =
                mock(
                        PurchaseOrderEntity.class
                );

        line =
                mock(
                        PurchaseOrderLineEntity.class
                );

        supplier =
                mock(
                        SupplierEntity.class
                );

        when(
                buyer.getId()
        ).thenReturn(
                userId
        );

        when(
                buyer.getFullName()
        ).thenReturn(
                "Daniel Moreau"
        );

        when(
                buyer.getRole()
        ).thenReturn(
                ProcurementRole.BUYER
        );

        when(
                buyer.isActive()
        ).thenReturn(true);

        when(
                order.getId()
        ).thenReturn(
                orderId
        );

        when(
                order.getPoNumber()
        ).thenReturn(
                "PO-2026-00001"
        );

        when(
                order.getStatus()
        ).thenReturn(
                PurchaseOrderStatus.ISSUED
        );

        when(
                order.getExpectedDeliveryDate()
        ).thenReturn(
                LocalDate.now()
                        .plusDays(5)
        );

        when(
                order.getSupplier()
        ).thenReturn(
                supplier
        );

        when(
                line.getId()
        ).thenReturn(
                lineId
        );

        when(
                line.getLineNumber()
        ).thenReturn(
                1
        );

        when(
                line.getItemName()
        ).thenReturn(
                "Business laptop"
        );

        when(
                line.getQuantity()
        ).thenReturn(
                new BigDecimal(
                        "5.000"
                )
        );

        when(
                line.getUnit()
        ).thenReturn(
                "EA"
        );

        when(
                order.getLines()
        ).thenReturn(
                List.of(line)
        );

        when(
                appUserRepository
                        .findById(
                                userId
                        )
        ).thenReturn(
                Optional.of(buyer)
        );

        when(
                purchaseOrderRepository
                        .findById(
                                orderId
                        )
        ).thenReturn(
                Optional.of(order)
        );

        when(
                goodsReceiptRepository
                        .nextReceiptSequence()
        ).thenReturn(
                4L
        );

        when(
                goodsReceiptRepository
                        .save(
                                any(
                                        GoodsReceiptEntity.class
                                )
                        )
        ).thenAnswer(
                invocation ->
                        invocation.getArgument(0)
        );
    }

    @Test
    void partialReceiptShouldBeAccepted() {
        when(
                goodsReceiptLineRepository
                        .totalReceivedForPurchaseOrderLine(
                                lineId
                        )
        )
                .thenReturn(
                        BigDecimal.ZERO
                )
                .thenReturn(
                        new BigDecimal(
                                "2.000"
                        )
                );

        GoodsReceiptResponse response =
                deliveryService
                        .createReceipt(
                                userId,
                                orderId,
                                new GoodsReceiptInput(
                                        LocalDate.now(),
                                        "DN-1001",
                                        "First partial shipment",
                                        List.of(
                                                new GoodsReceiptLineInput(
                                                        lineId,
                                                        new BigDecimal(
                                                                "2.000"
                                                        )
                                                )
                                        )
                                )
                        );

        assertEquals(
                "GR-"
                        + LocalDate.now().getYear()
                        + "-00004",
                response.receiptNumber()
        );

        assertEquals(
                new BigDecimal("2.000"),
                response.lines()
                        .getFirst()
                        .quantityReceived()
        );

        verify(
                performanceService
        ).refresh(
                supplier
        );
    }

    @Test
    void receiptCannotExceedRemainingQuantity() {
        when(
                goodsReceiptLineRepository
                        .totalReceivedForPurchaseOrderLine(
                                lineId
                        )
        ).thenReturn(
                new BigDecimal(
                        "4.000"
                )
        );

        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () ->
                                deliveryService
                                        .createReceipt(
                                                userId,
                                                orderId,
                                                new GoodsReceiptInput(
                                                        LocalDate.now(),
                                                        null,
                                                        null,
                                                        List.of(
                                                                new GoodsReceiptLineInput(
                                                                        lineId,
                                                                        new BigDecimal(
                                                                                "2.000"
                                                                        )
                                                                )
                                                        )
                                                )
                                        )
                );

        assertEquals(
                "Received quantity exceeds the remaining purchase order quantity for line 1.",
                exception.getMessage()
        );
    }
}
