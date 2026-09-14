package com.procureiq.delivery;

import com.procureiq.purchaseorder.PurchaseOrderEntity;
import com.procureiq.purchaseorder.PurchaseOrderLineEntity;
import com.procureiq.purchaseorder.PurchaseOrderRepository;
import com.procureiq.purchaseorder.PurchaseOrderStatus;
import com.procureiq.supplier.SupplierEntity;
import com.procureiq.supplier.SupplierRepository;
import com.procureiq.common.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class SupplierDeliveryPerformanceService {

    private static final BigDecimal HUNDRED =
            new BigDecimal("100.00");

    private final PurchaseOrderRepository
            purchaseOrderRepository;

    private final GoodsReceiptRepository
            goodsReceiptRepository;

    private final GoodsReceiptLineRepository
            goodsReceiptLineRepository;

    private final SupplierDeliveryPerformanceRepository
            performanceRepository;

    private final SupplierRepository
            supplierRepository;

    public SupplierDeliveryPerformanceService(
            PurchaseOrderRepository purchaseOrderRepository,
            GoodsReceiptRepository goodsReceiptRepository,
            GoodsReceiptLineRepository goodsReceiptLineRepository,
            SupplierDeliveryPerformanceRepository performanceRepository,
            SupplierRepository supplierRepository
    ) {
        this.purchaseOrderRepository =
                purchaseOrderRepository;

        this.goodsReceiptRepository =
                goodsReceiptRepository;

        this.goodsReceiptLineRepository =
                goodsReceiptLineRepository;

        this.performanceRepository =
                performanceRepository;

        this.supplierRepository =
                supplierRepository;
    }

    public SupplierDeliveryPerformanceResponse refresh(
            SupplierEntity supplier
    ) {
        List<PurchaseOrderEntity> orders =
                purchaseOrderRepository
                        .findAllBySupplier_Id(
                                supplier.getId()
                        )
                        .stream()
                        .filter(
                                order ->
                                        order.getStatus()
                                                != PurchaseOrderStatus.DRAFT
                                        &&
                                        order.getStatus()
                                                != PurchaseOrderStatus.CANCELLED
                        )
                        .toList();

        long completedOrders =
                orders.stream()
                        .filter(
                                order ->
                                        order.getStatus()
                                                == PurchaseOrderStatus.RECEIVED
                        )
                        .count();

        long onTimeOrders = 0;
        long lateOrders = 0;

        BigDecimal orderedQuantity =
                BigDecimal.ZERO;

        BigDecimal receivedQuantity =
                BigDecimal.ZERO;

        LocalDate lastReceiptDate =
                null;

        for (
                PurchaseOrderEntity order
                : orders
        ) {
            for (
                    PurchaseOrderLineEntity line
                    : order.getLines()
            ) {
                orderedQuantity =
                        orderedQuantity.add(
                                line.getQuantity()
                        );

                receivedQuantity =
                        receivedQuantity.add(
                                goodsReceiptLineRepository
                                        .totalReceivedForPurchaseOrderLine(
                                                line.getId()
                                        )
                        );
            }

            List<GoodsReceiptEntity> receipts =
                    goodsReceiptRepository
                            .findAllByPurchaseOrder_IdOrderByReceivedDateDescCreatedAtDesc(
                                    order.getId()
                            );

            LocalDate latestForOrder =
                    receipts.stream()
                            .map(
                                    GoodsReceiptEntity::
                                            getReceivedDate
                            )
                            .max(
                                    Comparator.naturalOrder()
                            )
                            .orElse(null);

            if (
                    latestForOrder != null
                    &&
                    (
                            lastReceiptDate == null
                            ||
                            latestForOrder
                                    .isAfter(
                                            lastReceiptDate
                                    )
                    )
            ) {
                lastReceiptDate =
                        latestForOrder;
            }

            if (
                    order.getStatus()
                            == PurchaseOrderStatus.RECEIVED
                    &&
                    latestForOrder != null
            ) {
                if (
                        latestForOrder.isAfter(
                                order.getExpectedDeliveryDate()
                        )
                ) {
                    lateOrders++;
                } else {
                    onTimeOrders++;
                }
            }
        }

        BigDecimal onTimeRate =
                completedOrders == 0
                        ? BigDecimal.ZERO
                                .setScale(2)
                        : BigDecimal.valueOf(
                                onTimeOrders
                        )
                                .multiply(
                                        HUNDRED
                                )
                                .divide(
                                        BigDecimal.valueOf(
                                                completedOrders
                                        ),
                                        2,
                                        RoundingMode.HALF_UP
                                );

        BigDecimal fulfillmentRate =
                orderedQuantity.compareTo(
                        BigDecimal.ZERO
                ) == 0
                        ? BigDecimal.ZERO
                                .setScale(2)
                        : receivedQuantity
                                .multiply(
                                        HUNDRED
                                )
                                .divide(
                                        orderedQuantity,
                                        2,
                                        RoundingMode.HALF_UP
                                )
                                .min(
                                        HUNDRED
                                );

        SupplierDeliveryPerformanceEntity performance =
                performanceRepository
                        .findBySupplier_Id(
                                supplier.getId()
                        )
                        .orElseGet(
                                SupplierDeliveryPerformanceEntity::new
                        );

        performance.setSupplier(
                supplier
        );

        performance.setTrackedOrders(
                orders.size()
        );

        performance.setCompletedOrders(
                completedOrders
        );

        performance.setOnTimeOrders(
                onTimeOrders
        );

        performance.setLateOrders(
                lateOrders
        );

        performance.setOrderedQuantity(
                orderedQuantity
                        .setScale(
                                3,
                                RoundingMode.HALF_UP
                        )
        );

        performance.setReceivedQuantity(
                receivedQuantity
                        .setScale(
                                3,
                                RoundingMode.HALF_UP
                        )
        );

        performance.setOnTimeDeliveryRate(
                onTimeRate
        );

        performance.setFulfillmentRate(
                fulfillmentRate
        );

        performance.setLastReceiptDate(
                lastReceiptDate
        );

        return toResponse(
                performanceRepository
                        .save(
                                performance
                        )
        );
    }

    @Transactional(readOnly = true)
    public SupplierDeliveryPerformanceResponse find(
            UUID supplierId
    ) {
        SupplierEntity supplier =
                supplierRepository
                        .findByIdAndActiveTrue(
                                supplierId
                        )
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Supplier not found: "
                                                        + supplierId
                                        )
                        );

        SupplierDeliveryPerformanceEntity performance =
                performanceRepository
                        .findBySupplier_Id(
                                supplierId
                        )
                        .orElse(null);

        if (performance == null) {
            return new SupplierDeliveryPerformanceResponse(
                    supplier.getId(),
                    supplier.getSupplierCode(),
                    supplier.getLegalName(),
                    0,
                    0,
                    0,
                    0,
                    BigDecimal.ZERO.setScale(3),
                    BigDecimal.ZERO.setScale(3),
                    BigDecimal.ZERO.setScale(2),
                    BigDecimal.ZERO.setScale(2),
                    null,
                    null
            );
        }

        return toResponse(
                performance
        );
    }

    private SupplierDeliveryPerformanceResponse toResponse(
            SupplierDeliveryPerformanceEntity performance
    ) {
        SupplierEntity supplier =
                performance.getSupplier();

        return new SupplierDeliveryPerformanceResponse(
                supplier.getId(),
                supplier.getSupplierCode(),
                supplier.getLegalName(),
                performance.getTrackedOrders(),
                performance.getCompletedOrders(),
                performance.getOnTimeOrders(),
                performance.getLateOrders(),
                performance.getOrderedQuantity(),
                performance.getReceivedQuantity(),
                performance.getOnTimeDeliveryRate(),
                performance.getFulfillmentRate(),
                performance.getLastReceiptDate(),
                performance.getUpdatedAt()
        );
    }
}
