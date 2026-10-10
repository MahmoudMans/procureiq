package com.procureiq.quotation;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.rfq.RfqEntity;
import com.procureiq.rfq.RfqInvitationStatus;
import com.procureiq.rfq.RfqLineItemEntity;
import com.procureiq.rfq.RfqRepository;
import com.procureiq.rfq.RfqStatus;
import com.procureiq.rfq.RfqSupplierInvitationEntity;
import com.procureiq.supplier.SupplierEntity;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
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
public class QuotationService {

    private final QuotationRepository
            quotationRepository;

    private final RfqRepository
            rfqRepository;

    private final AppUserRepository
            appUserRepository;

    public QuotationService(
            QuotationRepository quotationRepository,
            RfqRepository rfqRepository,
            AppUserRepository appUserRepository
    ) {
        this.quotationRepository =
                quotationRepository;

        this.rfqRepository =
                rfqRepository;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public List<QuotationResponse> findRfqQuotations(
            UUID currentUserId,
            UUID rfqId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertSourcingRole(
                user.getRole()
        );

        findRfq(rfqId);

        return quotationRepository
                .findAllByRfq_IdOrderByTotalAmountAsc(
                        rfqId
                )
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public QuotationResponse createQuotation(
            UUID currentUserId,
            UUID rfqId,
            QuotationCreateInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertSourcingRole(
                user.getRole()
        );

        RfqEntity rfq =
                findRfq(
                        rfqId
                );

        assertRfqAcceptingQuotationChanges(
                rfq
        );

        RfqSupplierInvitationEntity invitation =
                findInvitation(
                        rfq,
                        input.supplierId()
                );

        assertSupplierNotDeclined(
                rfq,
                input.supplierId()
        );

        if (
                quotationRepository
                        .existsByRfq_IdAndSupplier_Id(
                                rfq.getId(),
                                invitation.getSupplier()
                                        .getId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "A quotation already exists for this supplier and RFQ."
            );
        }

        QuotationEntity quotation =
                new QuotationEntity();

        quotation.setQuotationNumber(
                generateQuotationNumber()
        );

        quotation.setRfq(
                rfq
        );

        quotation.setSupplier(
                invitation.getSupplier()
        );

        quotation.setCurrency(
                rfq.getCurrency()
        );

        quotation.setRecordedBy(
                user
        );

        quotation.setStatus(
                QuotationStatus.DRAFT
        );

        applyCommercialTerms(
                quotation,
                input.leadTimeDays(),
                input.paymentTerms(),
                input.validityDate(),
                input.discountAmount(),
                input.shippingAmount(),
                input.taxAmount(),
                input.lines()
        );

        return toResponse(
                quotationRepository
                        .save(quotation)
        );
    }

    public QuotationResponse updateQuotation(
            UUID currentUserId,
            UUID quotationId,
            QuotationUpdateInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertSourcingRole(
                user.getRole()
        );

        QuotationEntity quotation =
                findQuotation(
                        quotationId
                );

        assertDraft(
                quotation
        );

        assertRfqAcceptingQuotationChanges(
                quotation.getRfq()
        );

        assertSupplierNotDeclined(
                quotation.getRfq(),
                quotation.getSupplier()
                        .getId()
        );

        applyCommercialTerms(
                quotation,
                input.leadTimeDays(),
                input.paymentTerms(),
                input.validityDate(),
                input.discountAmount(),
                input.shippingAmount(),
                input.taxAmount(),
                input.lines()
        );

        return toResponse(
                quotationRepository
                        .save(quotation)
        );
    }

    public QuotationResponse submitQuotation(
            UUID currentUserId,
            UUID quotationId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertSourcingRole(
                user.getRole()
        );

        QuotationEntity quotation =
                findQuotation(
                        quotationId
                );

        assertDraft(
                quotation
        );

        assertRfqAcceptingQuotationChanges(
                quotation.getRfq()
        );

        if (
                quotation.getValidityDate()
                        .isBefore(
                                LocalDate.now()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Quotation validity date has already expired."
            );
        }

        assertSupplierNotDeclined(
                quotation.getRfq(),
                quotation.getSupplier()
                        .getId()
        );

        quotation.setStatus(
                QuotationStatus.SUBMITTED
        );

        quotation.setSubmittedAt(
                Instant.now()
        );

        RfqSupplierInvitationEntity invitation =
                findInvitation(
                        quotation.getRfq(),
                        quotation.getSupplier()
                                .getId()
                );

        invitation.setStatus(
                RfqInvitationStatus.RESPONDED
        );

        invitation.setRespondedAt(
                Instant.now()
        );

        return toResponse(
                quotationRepository
                        .save(quotation)
        );
    }

    public QuotationResponse withdrawQuotation(
            UUID currentUserId,
            UUID quotationId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertSourcingRole(
                user.getRole()
        );

        QuotationEntity quotation =
                findQuotation(
                        quotationId
                );

        if (
                quotation.getStatus()
                        != QuotationStatus.SUBMITTED
        ) {
            throw new IllegalArgumentException(
                    "Only submitted quotations can be withdrawn."
            );
        }

        if (
                quotation.getRfq()
                        .getStatus()
                        != RfqStatus.PUBLISHED
        ) {
            throw new IllegalArgumentException(
                    "Quotation cannot be withdrawn after the RFQ has closed."
            );
        }

        quotation.setStatus(
                QuotationStatus.WITHDRAWN
        );

        quotation.setWithdrawnAt(
                Instant.now()
        );

        RfqSupplierInvitationEntity invitation =
                findInvitation(
                        quotation.getRfq(),
                        quotation.getSupplier()
                                .getId()
                );

        invitation.setStatus(
                RfqInvitationStatus.INVITED
        );

        invitation.setRespondedAt(
                null
        );

        return toResponse(
                quotationRepository
                        .save(quotation)
        );
    }

    @Transactional(readOnly = true)
    public QuotationComparisonResponse compare(
            UUID currentUserId,
            UUID rfqId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertSourcingRole(
                user.getRole()
        );

        RfqEntity rfq =
                findRfq(
                        rfqId
                );

        List<QuotationEntity> submitted =
                quotationRepository
                        .findAllByRfq_IdOrderByTotalAmountAsc(
                                rfqId
                        )
                        .stream()
                        .filter(
                                quotation ->
                                        quotation.getStatus()
                                                == QuotationStatus.SUBMITTED
                        )
                        .sorted(
                                Comparator
                                        .comparing(
                                                QuotationEntity::
                                                        getTotalAmount
                                        )
                        )
                        .toList();

        if (submitted.isEmpty()) {
            return new QuotationComparisonResponse(
                    rfq.getId(),
                    rfq.getRfqNumber(),
                    rfq.getCurrency(),
                    0,
                    null,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    List.of()
            );
        }

        BigDecimal lowest =
                submitted.getFirst()
                        .getTotalAmount();

        BigDecimal highest =
                submitted.getLast()
                        .getTotalAmount();

        BigDecimal savings =
                highest.subtract(
                        lowest
                )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        List<QuotationComparisonItemResponse>
                items =
                new ArrayList<>();

        for (
                int index = 0;
                index < submitted.size();
                index++
        ) {
            QuotationEntity quotation =
                    submitted.get(index);

            BigDecimal variance =
                    quotation.getTotalAmount()
                            .subtract(lowest)
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            );

            BigDecimal savingsVsHighest =
                    highest
                            .subtract(
                                    quotation.getTotalAmount()
                            )
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            );

            items.add(
                    new QuotationComparisonItemResponse(
                            quotation.getId(),
                            quotation.getQuotationNumber(),
                            quotation.getSupplier().getId(),
                            quotation.getSupplier().getLegalName(),
                            quotation.getTotalAmount(),
                            index + 1,
                            index == 0,
                            variance,
                            savingsVsHighest,
                            quotation.getLeadTimeDays(),
                            quotation.getPaymentTerms(),
                            quotation.getValidityDate()
                    )
            );
        }

        return new QuotationComparisonResponse(
                rfq.getId(),
                rfq.getRfqNumber(),
                rfq.getCurrency(),
                submitted.size(),
                submitted.getFirst()
                        .getId(),
                lowest,
                highest,
                savings,
                items
        );
    }

    private void applyCommercialTerms(
            QuotationEntity quotation,
            int leadTimeDays,
            String paymentTerms,
            LocalDate validityDate,
            BigDecimal discountAmount,
            BigDecimal shippingAmount,
            BigDecimal taxAmount,
            List<QuotationLineInput> lineInputs
    ) {
        RfqEntity rfq =
                quotation.getRfq();

        Map<UUID, RfqLineItemEntity>
                rfqLines =
                new HashMap<>();

        for (
                RfqLineItemEntity line
                : rfq.getLineItems()
        ) {
            rfqLines.put(
                    line.getId(),
                    line
            );
        }

        if (
                lineInputs.size()
                        != rfqLines.size()
        ) {
            throw new IllegalArgumentException(
                    "Quotation must contain pricing for every RFQ line."
            );
        }

        Set<UUID> seen =
                new HashSet<>();

        List<QuotationLineEntity>
                quotationLines =
                new ArrayList<>();

        BigDecimal subtotal =
                BigDecimal.ZERO;

        for (
                QuotationLineInput input
                : lineInputs
        ) {
            if (
                    !seen.add(
                            input.rfqLineItemId()
                    )
            ) {
                throw new IllegalArgumentException(
                        "Quotation contains duplicate RFQ line pricing."
                );
            }

            RfqLineItemEntity rfqLine =
                    rfqLines.get(
                            input.rfqLineItemId()
                    );

            if (rfqLine == null) {
                throw new IllegalArgumentException(
                        "Quotation contains a line that does not belong to this RFQ."
                );
            }

            BigDecimal unitPrice =
                    input.unitPrice()
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            );

            BigDecimal lineSubtotal =
                    rfqLine.getQuantity()
                            .multiply(
                                    unitPrice
                            )
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            );

            QuotationLineEntity line =
                    new QuotationLineEntity();

            line.setRfqLineItem(
                    rfqLine
            );

            line.setLineNumber(
                    rfqLine.getLineNumber()
            );

            line.setQuantity(
                    rfqLine.getQuantity()
            );

            line.setUnit(
                    rfqLine.getUnit()
            );

            line.setUnitPrice(
                    unitPrice
            );

            line.setLineSubtotal(
                    lineSubtotal
            );

            quotationLines.add(
                    line
            );

            subtotal =
                    subtotal.add(
                            lineSubtotal
                    );
        }

        BigDecimal normalizedDiscount =
                normalizeAmount(
                        discountAmount
                );

        BigDecimal normalizedShipping =
                normalizeAmount(
                        shippingAmount
                );

        BigDecimal normalizedTax =
                normalizeAmount(
                        taxAmount
                );

        subtotal =
                subtotal.setScale(
                        2,
                        RoundingMode.HALF_UP
                );

        if (
                normalizedDiscount.compareTo(
                        subtotal
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Quotation discount cannot exceed the quotation subtotal."
            );
        }

        BigDecimal total =
                subtotal
                        .subtract(
                                normalizedDiscount
                        )
                        .add(
                                normalizedShipping
                        )
                        .add(
                                normalizedTax
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        if (
                total.compareTo(
                        BigDecimal.ZERO
                ) < 0
        ) {
            throw new IllegalArgumentException(
                    "Quotation total cannot be negative."
            );
        }

        quotation.setLeadTimeDays(
                leadTimeDays
        );

        quotation.setPaymentTerms(
                normalizeRequired(
                        paymentTerms
                )
        );

        quotation.setValidityDate(
                validityDate
        );

        quotation.setSubtotal(
                subtotal
        );

        quotation.setDiscountAmount(
                normalizedDiscount
        );

        quotation.setShippingAmount(
                normalizedShipping
        );

        quotation.setTaxAmount(
                normalizedTax
        );

        quotation.setTotalAmount(
                total
        );

        quotation.replaceLines(
                quotationLines
        );
    }

    private BigDecimal normalizeAmount(
            BigDecimal amount
    ) {
        return amount
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private RfqSupplierInvitationEntity findInvitation(
            RfqEntity rfq,
            UUID supplierId
    ) {
        return rfq.getInvitations()
                .stream()
                .filter(
                        invitation ->
                                invitation.getSupplier()
                                        .getId()
                                        .equals(
                                                supplierId
                                        )
                )
                .findFirst()
                .orElseThrow(
                        () ->
                                new IllegalArgumentException(
                                        "Supplier is not invited to this RFQ."
                                )
                );
    }

    private RfqEntity findRfq(
            UUID rfqId
    ) {
        return rfqRepository
                .findById(rfqId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "RFQ not found: "
                                                + rfqId
                                )
                );
    }

    private QuotationEntity findQuotation(
            UUID quotationId
    ) {
        return quotationRepository
                .findById(
                        quotationId
                )
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Quotation not found: "
                                                + quotationId
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

    private void assertSourcingRole(
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
                    "Your ProcureIQ role cannot manage supplier quotations."
            );
        }
    }

    private void assertSupplierNotDeclined(
            RfqEntity rfq,
            UUID supplierId
    ) {
        boolean declined =
                rfq.getInvitations()
                        .stream()
                        .anyMatch(
                                invitation ->
                                        invitation.getSupplier()
                                                .getId()
                                                .equals(
                                                        supplierId
                                                )
                                        &&
                                        invitation.getStatus()
                                                == RfqInvitationStatus.DECLINED
                        );

        if (declined) {
            throw new IllegalArgumentException(
                    "This supplier has declined the invitation to this RFQ, so a quotation cannot be recorded or submitted for it. The supplier must reconsider the invitation first."
            );
        }
    }

    private void assertRfqAcceptingQuotationChanges(
            RfqEntity rfq
    ) {
        if (
                rfq.getStatus()
                        != RfqStatus.PUBLISHED
        ) {
            throw new IllegalArgumentException(
                    "Supplier quotations can only be recorded while the RFQ is published."
            );
        }
    }

    private void assertDraft(
            QuotationEntity quotation
    ) {
        if (
                quotation.getStatus()
                        != QuotationStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only draft quotations can be edited or submitted."
            );
        }
    }

    private String generateQuotationNumber() {
        Long sequence =
                quotationRepository
                        .nextQuotationSequence();

        int year =
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue();

        return String.format(
                "QT-%d-%05d",
                year,
                sequence
        );
    }

    private QuotationResponse toResponse(
            QuotationEntity quotation
    ) {
        SupplierEntity supplier =
                quotation.getSupplier();

        List<QuotationLineResponse> lines =
                quotation.getLines()
                        .stream()
                        .sorted(
                                Comparator.comparingInt(
                                        QuotationLineEntity::
                                                getLineNumber
                                )
                        )
                        .map(
                                line ->
                                        new QuotationLineResponse(
                                                line.getId(),
                                                line.getRfqLineItem()
                                                        .getId(),
                                                line.getLineNumber(),
                                                line.getRfqLineItem()
                                                        .getItemName(),
                                                line.getRfqLineItem()
                                                        .getCategory(),
                                                line.getQuantity(),
                                                line.getUnit(),
                                                line.getUnitPrice(),
                                                line.getLineSubtotal()
                                        )
                        )
                        .toList();

        return new QuotationResponse(
                quotation.getId(),
                quotation.getQuotationNumber(),
                quotation.getRfq().getId(),
                quotation.getRfq().getRfqNumber(),
                supplier.getId(),
                supplier.getSupplierCode(),
                supplier.getLegalName(),
                quotation.getCurrency(),
                quotation.getLeadTimeDays(),
                quotation.getPaymentTerms(),
                quotation.getValidityDate(),
                quotation.getSubtotal(),
                quotation.getDiscountAmount(),
                quotation.getShippingAmount(),
                quotation.getTaxAmount(),
                quotation.getTotalAmount(),
                quotation.getStatus(),
                quotation.getRecordedBy().getId(),
                quotation.getRecordedBy().getFullName(),
                lines,
                quotation.getSubmittedAt(),
                quotation.getWithdrawnAt(),
                quotation.getCreatedAt(),
                quotation.getUpdatedAt(),
                quotation.getVersion()
        );
    }

    private String normalizeRequired(
            String value
    ) {
        return value.trim();
    }
}
