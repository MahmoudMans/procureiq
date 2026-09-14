package com.procureiq.delivery;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.purchaseorder.PurchaseOrderEntity;
import com.procureiq.purchaseorder.PurchaseOrderLineEntity;
import com.procureiq.purchaseorder.PurchaseOrderRepository;
import com.procureiq.purchaseorder.PurchaseOrderStatus;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class DeliveryService {

    private final GoodsReceiptRepository
            goodsReceiptRepository;

    private final GoodsReceiptLineRepository
            goodsReceiptLineRepository;

    private final PurchaseOrderRepository
            purchaseOrderRepository;

    private final AppUserRepository
            appUserRepository;

    private final SupplierDeliveryPerformanceService
            performanceService;

    public DeliveryService(
            GoodsReceiptRepository goodsReceiptRepository,
            GoodsReceiptLineRepository goodsReceiptLineRepository,
            PurchaseOrderRepository purchaseOrderRepository,
            AppUserRepository appUserRepository,
            SupplierDeliveryPerformanceService performanceService
    ) {
        this.goodsReceiptRepository =
                goodsReceiptRepository;

        this.goodsReceiptLineRepository =
                goodsReceiptLineRepository;

        this.purchaseOrderRepository =
                purchaseOrderRepository;

        this.appUserRepository =
                appUserRepository;

        this.performanceService =
                performanceService;
    }

    @Transactional(readOnly = true)
    public List<GoodsReceiptResponse> findReceipts(
            UUID currentUserId,
            UUID purchaseOrderId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertDeliveryRole(
                user.getRole()
        );

        findPurchaseOrder(
                purchaseOrderId
        );

        return goodsReceiptRepository
                .findAllByPurchaseOrder_IdOrderByReceivedDateDescCreatedAtDesc(
                        purchaseOrderId
                )
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PurchaseOrderReceivingResponse
    getReceivingState(
            UUID currentUserId,
            UUID purchaseOrderId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertDeliveryRole(
                user.getRole()
        );

        PurchaseOrderEntity order =
                findPurchaseOrder(
                        purchaseOrderId
                );

        return buildReceivingState(
                order
        );
    }

    public GoodsReceiptResponse createReceipt(
            UUID currentUserId,
            UUID purchaseOrderId,
            GoodsReceiptInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertDeliveryRole(
                user.getRole()
        );

        PurchaseOrderEntity order =
                findPurchaseOrder(
                        purchaseOrderId
                );

        if (
                order.getStatus()
                        != PurchaseOrderStatus.ISSUED
                &&
                order.getStatus()
                        != PurchaseOrderStatus.PARTIALLY_RECEIVED
        ) {
            throw new IllegalArgumentException(
                    "Goods receipts can only be recorded for issued or partially received purchase orders."
            );
        }

        Map<UUID, PurchaseOrderLineEntity>
                orderLines =
                new HashMap<>();

        for (
                PurchaseOrderLineEntity line
                : order.getLines()
        ) {
            orderLines.put(
                    line.getId(),
                    line
            );
        }

        Set<UUID> seen =
                new HashSet<>();

        List<GoodsReceiptLineEntity>
                receiptLines =
                new ArrayList<>();

        for (
                GoodsReceiptLineInput lineInput
                : input.lines()
        ) {
            if (
                    !seen.add(
                            lineInput.purchaseOrderLineId()
                    )
            ) {
                throw new IllegalArgumentException(
                        "A purchase order line cannot appear more than once in the same goods receipt."
                );
            }

            PurchaseOrderLineEntity orderLine =
                    orderLines.get(
                            lineInput.purchaseOrderLineId()
                    );

            if (orderLine == null) {
                throw new IllegalArgumentException(
                        "Goods receipt contains a line that does not belong to this purchase order."
                );
            }

            BigDecimal previouslyReceived =
                    goodsReceiptLineRepository
                            .totalReceivedForPurchaseOrderLine(
                                    orderLine.getId()
                            );

            BigDecimal remaining =
                    orderLine.getQuantity()
                            .subtract(
                                    previouslyReceived
                            );

            BigDecimal receiving =
                    lineInput.quantityReceived()
                            .setScale(
                                    3,
                                    RoundingMode.HALF_UP
                            );

            if (
                    receiving.compareTo(
                            remaining
                    ) > 0
            ) {
                throw new IllegalArgumentException(
                        "Received quantity exceeds the remaining purchase order quantity for line "
                                + orderLine.getLineNumber()
                                + "."
                );
            }

            GoodsReceiptLineEntity receiptLine =
                    new GoodsReceiptLineEntity();

            receiptLine.setPurchaseOrderLine(
                    orderLine
            );

            receiptLine.setQuantityReceived(
                    receiving
            );

            receiptLines.add(
                    receiptLine
            );
        }

        GoodsReceiptEntity receipt =
                new GoodsReceiptEntity();

        receipt.setReceiptNumber(
                generateReceiptNumber()
        );

        receipt.setPurchaseOrder(
                order
        );

        receipt.setReceivedDate(
                input.receivedDate()
        );

        receipt.setDeliveryReference(
                normalizeOptional(
                        input.deliveryReference()
                )
        );

        receipt.setNotes(
                normalizeOptional(
                        input.notes()
                )
        );

        receipt.setRecordedBy(
                user
        );

        receipt.replaceLines(
                receiptLines
        );

        GoodsReceiptEntity saved =
                goodsReceiptRepository
                        .save(receipt);

        updatePurchaseOrderReceivingStatus(
                order
        );

        performanceService.refresh(
                order.getSupplier()
        );

        return toResponse(
                saved
        );
    }

    @Transactional(readOnly = true)
    public DeliverySummaryResponse getSummary(
            UUID currentUserId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertDeliveryRole(
                user.getRole()
        );

        List<PurchaseOrderEntity> orders =
                purchaseOrderRepository
                        .search(
                                null,
                                null
                        );

        long open =
                orders.stream()
                        .filter(
                                order ->
                                        order.getStatus()
                                                == PurchaseOrderStatus.ISSUED
                                        ||
                                        order.getStatus()
                                                == PurchaseOrderStatus.PARTIALLY_RECEIVED
                        )
                        .count();

        long partial =
                orders.stream()
                        .filter(
                                order ->
                                        order.getStatus()
                                                == PurchaseOrderStatus.PARTIALLY_RECEIVED
                        )
                        .count();

        long completed =
                orders.stream()
                        .filter(
                                order ->
                                        order.getStatus()
                                                == PurchaseOrderStatus.RECEIVED
                        )
                        .count();

        LocalDate today =
                LocalDate.now();

        long overdue =
                orders.stream()
                        .filter(
                                order ->
                                        (
                                                order.getStatus()
                                                        == PurchaseOrderStatus.ISSUED
                                                ||
                                                order.getStatus()
                                                        == PurchaseOrderStatus.PARTIALLY_RECEIVED
                                        )
                                        &&
                                        order.getExpectedDeliveryDate()
                                                .isBefore(today)
                        )
                        .count();

        return new DeliverySummaryResponse(
                goodsReceiptRepository.count(),
                open,
                partial,
                completed,
                overdue
        );
    }

    private void updatePurchaseOrderReceivingStatus(
            PurchaseOrderEntity order
    ) {
        boolean anyReceived =
                false;

        boolean allComplete =
                true;

        for (
                PurchaseOrderLineEntity line
                : order.getLines()
        ) {
            BigDecimal received =
                    goodsReceiptLineRepository
                            .totalReceivedForPurchaseOrderLine(
                                    line.getId()
                            );

            if (
                    received.compareTo(
                            BigDecimal.ZERO
                    ) > 0
            ) {
                anyReceived = true;
            }

            if (
                    received.compareTo(
                            line.getQuantity()
                    ) < 0
            ) {
                allComplete = false;
            }
        }

        if (allComplete) {
            order.setStatus(
                    PurchaseOrderStatus.RECEIVED
            );
        } else if (anyReceived) {
            order.setStatus(
                    PurchaseOrderStatus.PARTIALLY_RECEIVED
            );
        }

        purchaseOrderRepository
                .save(order);
    }

    private PurchaseOrderReceivingResponse
    buildReceivingState(
            PurchaseOrderEntity order
    ) {
        List<PurchaseOrderReceivingLineResponse>
                lines =
                order.getLines()
                        .stream()
                        .sorted(
                                Comparator.comparingInt(
                                        PurchaseOrderLineEntity::
                                                getLineNumber
                                )
                        )
                        .map(
                                line -> {
                                    BigDecimal received =
                                            goodsReceiptLineRepository
                                                    .totalReceivedForPurchaseOrderLine(
                                                            line.getId()
                                                    )
                                                    .setScale(
                                                            3,
                                                            RoundingMode.HALF_UP
                                                    );

                                    BigDecimal remaining =
                                            line.getQuantity()
                                                    .subtract(
                                                            received
                                                    )
                                                    .max(
                                                            BigDecimal.ZERO
                                                    )
                                                    .setScale(
                                                            3,
                                                            RoundingMode.HALF_UP
                                                    );

                                    return new PurchaseOrderReceivingLineResponse(
                                            line.getId(),
                                            line.getLineNumber(),
                                            line.getItemName(),
                                            line.getQuantity(),
                                            received,
                                            remaining,
                                            line.getUnit(),
                                            remaining.compareTo(
                                                    BigDecimal.ZERO
                                            ) == 0
                                    );
                                }
                        )
                        .toList();

        boolean overdue =
                (
                        order.getStatus()
                                == PurchaseOrderStatus.ISSUED
                        ||
                        order.getStatus()
                                == PurchaseOrderStatus.PARTIALLY_RECEIVED
                )
                &&
                order.getExpectedDeliveryDate()
                        .isBefore(
                                LocalDate.now()
                        );

        return new PurchaseOrderReceivingResponse(
                order.getId(),
                order.getPoNumber(),
                order.getStatus(),
                order.getExpectedDeliveryDate(),
                overdue,
                lines
        );
    }

    private GoodsReceiptResponse toResponse(
            GoodsReceiptEntity receipt
    ) {
        PurchaseOrderEntity order =
                receipt.getPurchaseOrder();

        List<GoodsReceiptLineResponse> lines =
                receipt.getLines()
                        .stream()
                        .sorted(
                                Comparator.comparingInt(
                                        line ->
                                                line.getPurchaseOrderLine()
                                                        .getLineNumber()
                                )
                        )
                        .map(
                                line -> {
                                    PurchaseOrderLineEntity orderLine =
                                            line.getPurchaseOrderLine();

                                    return new GoodsReceiptLineResponse(
                                            line.getId(),
                                            orderLine.getId(),
                                            orderLine.getLineNumber(),
                                            orderLine.getItemName(),
                                            orderLine.getQuantity(),
                                            line.getQuantityReceived(),
                                            orderLine.getUnit()
                                    );
                                }
                        )
                        .toList();

        return new GoodsReceiptResponse(
                receipt.getId(),
                receipt.getReceiptNumber(),
                order.getId(),
                order.getPoNumber(),
                receipt.getReceivedDate(),
                receipt.getDeliveryReference(),
                receipt.getNotes(),
                receipt.getReceivedDate()
                        .isAfter(
                                order.getExpectedDeliveryDate()
                        ),
                receipt.getRecordedBy().getId(),
                receipt.getRecordedBy().getFullName(),
                lines,
                receipt.getCreatedAt()
        );
    }

    private PurchaseOrderEntity findPurchaseOrder(
            UUID purchaseOrderId
    ) {
        return purchaseOrderRepository
                .findById(
                        purchaseOrderId
                )
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Purchase order not found: "
                                                + purchaseOrderId
                                )
                );
    }

    private AppUserEntity findCurrentUser(
            UUID userId
    ) {
        AppUserEntity user =
                appUserRepository
                        .findById(userId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Authenticated ProcureIQ user not found."
                                        )
                        );

        if (!user.isActive()) {
            throw new IllegalArgumentException(
                    "The authenticated ProcureIQ account is inactive."
            );
        }

        return user;
    }

    private void assertDeliveryRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role != ProcurementRole.BUYER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot manage goods receipts."
            );
        }
    }

    private String generateReceiptNumber() {
        Long sequence =
                goodsReceiptRepository
                        .nextReceiptSequence();

        int year =
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue();

        return String.format(
                "GR-%d-%05d",
                year,
                sequence
        );
    }

    private String normalizeOptional(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String normalized =
                value.trim();

        return normalized.isEmpty()
                ? null
                : normalized;
    }
}
