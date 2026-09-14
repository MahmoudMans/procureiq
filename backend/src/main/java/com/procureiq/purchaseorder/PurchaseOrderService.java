package com.procureiq.purchaseorder;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.evaluation.AwardDecisionEntity;
import com.procureiq.evaluation.AwardDecisionRepository;
import com.procureiq.quotation.QuotationEntity;
import com.procureiq.quotation.QuotationLineEntity;
import com.procureiq.quotation.QuotationStatus;
import com.procureiq.rfq.RfqEntity;
import com.procureiq.rfq.RfqRepository;
import com.procureiq.rfq.RfqStatus;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class PurchaseOrderService {

    private final PurchaseOrderRepository
            purchaseOrderRepository;

    private final RfqRepository
            rfqRepository;

    private final AwardDecisionRepository
            awardDecisionRepository;

    private final AppUserRepository
            appUserRepository;

    public PurchaseOrderService(
            PurchaseOrderRepository purchaseOrderRepository,
            RfqRepository rfqRepository,
            AwardDecisionRepository awardDecisionRepository,
            AppUserRepository appUserRepository
    ) {
        this.purchaseOrderRepository =
                purchaseOrderRepository;

        this.rfqRepository =
                rfqRepository;

        this.awardDecisionRepository =
                awardDecisionRepository;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public List<PurchaseOrderResponse> findOrders(
            UUID currentUserId,
            String query,
            PurchaseOrderStatus status
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertPurchasingRole(
                user.getRole()
        );

        return purchaseOrderRepository
                .search(
                        normalizeOptional(query),
                        status
                )
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PurchaseOrderResponse findOrder(
            UUID currentUserId,
            UUID purchaseOrderId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertPurchasingRole(
                user.getRole()
        );

        return toResponse(
                findOrderEntity(
                        purchaseOrderId
                )
        );
    }

    public PurchaseOrderResponse createOrder(
            UUID currentUserId,
            PurchaseOrderCreateInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertPurchasingRole(
                user.getRole()
        );

        RfqEntity rfq =
                rfqRepository
                        .findById(
                                input.rfqId()
                        )
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "RFQ not found: "
                                                        + input.rfqId()
                                        )
                        );

        if (
                rfq.getStatus()
                        != RfqStatus.AWARDED
        ) {
            throw new IllegalArgumentException(
                    "Only awarded RFQs can be converted into purchase orders."
            );
        }

        if (
                purchaseOrderRepository
                        .existsByRfq_Id(
                                rfq.getId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "A purchase order already exists for this awarded RFQ."
            );
        }

        AwardDecisionEntity award =
                awardDecisionRepository
                        .findByRfq_Id(
                                rfq.getId()
                        )
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "The awarded RFQ does not contain an award decision."
                                        )
                        );

        QuotationEntity quotation =
                award.getSelectedQuotation();

        if (
                quotation.getStatus()
                        != QuotationStatus.SUBMITTED
        ) {
            throw new IllegalArgumentException(
                    "The awarded quotation must remain submitted when the purchase order is created."
            );
        }

        PurchaseOrderEntity order =
                new PurchaseOrderEntity();

        order.setPoNumber(
                generatePoNumber()
        );

        order.setRfq(rfq);

        order.setAwardDecision(
                award
        );

        order.setQuotation(
                quotation
        );

        order.setSupplier(
                quotation.getSupplier()
        );

        order.setCurrency(
                quotation.getCurrency()
        );

        order.setPaymentTerms(
                quotation.getPaymentTerms()
        );

        order.setExpectedDeliveryDate(
                input.expectedDeliveryDate()
        );

        order.setDeliveryAddress(
                normalizeRequired(
                        input.deliveryAddress()
                )
        );

        order.setBuyerNotes(
                normalizeOptional(
                        input.buyerNotes()
                )
        );

        order.setSubtotal(
                quotation.getSubtotal()
        );

        order.setDiscountAmount(
                quotation.getDiscountAmount()
        );

        order.setShippingAmount(
                quotation.getShippingAmount()
        );

        order.setTaxAmount(
                quotation.getTaxAmount()
        );

        order.setTotalAmount(
                quotation.getTotalAmount()
        );

        order.setStatus(
                PurchaseOrderStatus.DRAFT
        );

        order.setCreatedBy(
                user
        );

        copyAwardedLines(
                order,
                quotation
        );

        return toResponse(
                purchaseOrderRepository
                        .save(order)
        );
    }

    public PurchaseOrderResponse updateOrder(
            UUID currentUserId,
            UUID purchaseOrderId,
            PurchaseOrderUpdateInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertPurchasingRole(
                user.getRole()
        );

        PurchaseOrderEntity order =
                findOrderEntity(
                        purchaseOrderId
                );

        assertDraft(order);

        order.setExpectedDeliveryDate(
                input.expectedDeliveryDate()
        );

        order.setDeliveryAddress(
                normalizeRequired(
                        input.deliveryAddress()
                )
        );

        order.setBuyerNotes(
                normalizeOptional(
                        input.buyerNotes()
                )
        );

        return toResponse(
                purchaseOrderRepository
                        .save(order)
        );
    }

    public PurchaseOrderResponse issueOrder(
            UUID currentUserId,
            UUID purchaseOrderId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertPurchasingRole(
                user.getRole()
        );

        PurchaseOrderEntity order =
                findOrderEntity(
                        purchaseOrderId
                );

        assertDraft(order);

        if (
                order.getLines().isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "A purchase order cannot be issued without line items."
            );
        }

        order.setStatus(
                PurchaseOrderStatus.ISSUED
        );

        order.setIssuedBy(
                user
        );

        order.setIssuedAt(
                Instant.now()
        );

        return toResponse(
                purchaseOrderRepository
                        .save(order)
        );
    }

    public PurchaseOrderResponse cancelOrder(
            UUID currentUserId,
            UUID purchaseOrderId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertPurchasingRole(
                user.getRole()
        );

        PurchaseOrderEntity order =
                findOrderEntity(
                        purchaseOrderId
                );

        if (
                order.getStatus()
                        != PurchaseOrderStatus.DRAFT
                &&
                order.getStatus()
                        != PurchaseOrderStatus.ISSUED
        ) {
            throw new IllegalArgumentException(
                    "Only draft or issued purchase orders can be cancelled."
            );
        }

        order.setStatus(
                PurchaseOrderStatus.CANCELLED
        );

        order.setCancelledAt(
                Instant.now()
        );

        return toResponse(
                purchaseOrderRepository
                        .save(order)
        );
    }

    @Transactional(readOnly = true)
    public PurchaseOrderSummaryResponse getSummary(
            UUID currentUserId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertPurchasingRole(
                user.getRole()
        );

        List<PurchaseOrderEntity> orders =
                purchaseOrderRepository
                        .search(
                                null,
                                null
                        );

        long drafts =
                countStatus(
                        orders,
                        PurchaseOrderStatus.DRAFT
                );

        long issued =
                countStatus(
                        orders,
                        PurchaseOrderStatus.ISSUED
                );

        long cancelled =
                countStatus(
                        orders,
                        PurchaseOrderStatus.CANCELLED
                );

        BigDecimal issuedValue =
                orders.stream()
                        .filter(
                                order ->
                                        order.getStatus()
                                                == PurchaseOrderStatus.ISSUED
                        )
                        .map(
                                PurchaseOrderEntity::
                                        getTotalAmount
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal draftValue =
                orders.stream()
                        .filter(
                                order ->
                                        order.getStatus()
                                                == PurchaseOrderStatus.DRAFT
                        )
                        .map(
                                PurchaseOrderEntity::
                                        getTotalAmount
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        return new PurchaseOrderSummaryResponse(
                orders.size(),
                drafts,
                issued,
                cancelled,
                issuedValue,
                draftValue
        );
    }

    private void copyAwardedLines(
            PurchaseOrderEntity order,
            QuotationEntity quotation
    ) {
        List<PurchaseOrderLineEntity> lines =
                new ArrayList<>();

        for (
                QuotationLineEntity quotationLine
                : quotation.getLines()
        ) {
            PurchaseOrderLineEntity line =
                    new PurchaseOrderLineEntity();

            line.setLineNumber(
                    quotationLine.getLineNumber()
            );

            line.setItemName(
                    quotationLine
                            .getRfqLineItem()
                            .getItemName()
            );

            line.setDescription(
                    quotationLine
                            .getRfqLineItem()
                            .getDescription()
            );

            line.setCategory(
                    quotationLine
                            .getRfqLineItem()
                            .getCategory()
            );

            line.setQuantity(
                    quotationLine.getQuantity()
            );

            line.setUnit(
                    quotationLine.getUnit()
            );

            line.setUnitPrice(
                    quotationLine.getUnitPrice()
            );

            line.setLineTotal(
                    quotationLine.getLineSubtotal()
            );

            lines.add(line);
        }

        if (lines.isEmpty()) {
            throw new IllegalArgumentException(
                    "The awarded quotation does not contain any line items."
            );
        }

        order.replaceLines(
                lines
        );
    }

    private PurchaseOrderEntity findOrderEntity(
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
                        .findById(
                                userId
                        )
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

    private void assertPurchasingRole(
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
                    "Your ProcureIQ role cannot manage purchase orders."
            );
        }
    }

    private void assertDraft(
            PurchaseOrderEntity order
    ) {
        if (
                order.getStatus()
                        != PurchaseOrderStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only draft purchase orders can be edited or issued."
            );
        }
    }

    private long countStatus(
            List<PurchaseOrderEntity> orders,
            PurchaseOrderStatus status
    ) {
        return orders.stream()
                .filter(
                        order ->
                                order.getStatus()
                                        == status
                )
                .count();
    }

    private String generatePoNumber() {
        Long sequence =
                purchaseOrderRepository
                        .nextPurchaseOrderSequence();

        int year =
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue();

        return String.format(
                "PO-%d-%05d",
                year,
                sequence
        );
    }

    private PurchaseOrderResponse toResponse(
            PurchaseOrderEntity order
    ) {
        List<PurchaseOrderLineResponse> lines =
                order.getLines()
                        .stream()
                        .sorted(
                                Comparator.comparingInt(
                                        PurchaseOrderLineEntity::
                                                getLineNumber
                                )
                        )
                        .map(
                                line ->
                                        new PurchaseOrderLineResponse(
                                                line.getId(),
                                                line.getLineNumber(),
                                                line.getItemName(),
                                                line.getDescription(),
                                                line.getCategory(),
                                                line.getQuantity(),
                                                line.getUnit(),
                                                line.getUnitPrice(),
                                                line.getLineTotal()
                                        )
                        )
                        .toList();

        AppUserEntity issuedBy =
                order.getIssuedBy();

        return new PurchaseOrderResponse(
                order.getId(),
                order.getPoNumber(),
                order.getRfq().getId(),
                order.getRfq().getRfqNumber(),
                order.getRfq()
                        .getSourcePurchaseRequest()
                        .getId(),
                order.getRfq()
                        .getSourcePurchaseRequest()
                        .getRequestNumber(),
                order.getAwardDecision().getId(),
                order.getQuotation().getId(),
                order.getQuotation()
                        .getQuotationNumber(),
                order.getSupplier().getId(),
                order.getSupplier()
                        .getSupplierCode(),
                order.getSupplier()
                        .getLegalName(),
                order.getCurrency(),
                order.getPaymentTerms(),
                order.getExpectedDeliveryDate(),
                order.getDeliveryAddress(),
                order.getBuyerNotes(),
                order.getSubtotal(),
                order.getDiscountAmount(),
                order.getShippingAmount(),
                order.getTaxAmount(),
                order.getTotalAmount(),
                order.getStatus(),
                order.getCreatedBy().getId(),
                order.getCreatedBy().getFullName(),
                issuedBy == null
                        ? null
                        : issuedBy.getId(),
                issuedBy == null
                        ? null
                        : issuedBy.getFullName(),
                lines,
                order.getIssuedAt(),
                order.getCancelledAt(),
                order.getCreatedAt(),
                order.getUpdatedAt(),
                order.getVersion()
        );
    }

    private String normalizeRequired(
            String value
    ) {
        return value.trim();
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
