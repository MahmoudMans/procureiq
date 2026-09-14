package com.procureiq.invoice;

import com.procureiq.common.exception.ResourceNotFoundException;
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
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class InvoiceService {

    private final InvoiceRepository repository;

    private final InvoiceCalculationService calculationService;

    private final AppUserRepository appUserRepository;

    public InvoiceService(
            InvoiceRepository repository,
            InvoiceCalculationService calculationService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.calculationService =
                calculationService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public List<ProcurementInvoiceResponse> invoices(
            UUID currentUserId,
            String currency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return repository
                .findInvoices(
                        normalizeCurrency(
                                currency
                        )
                )
                .stream()
                .map(
                        this::invoiceResponse
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public ProcurementInvoiceResponse invoice(
            UUID currentUserId,
            UUID invoiceId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return invoiceResponse(
                requireInvoice(
                        invoiceId
                )
        );
    }

    public ProcurementInvoiceResponse createInvoice(
            UUID currentUserId,
            ProcurementInvoiceInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        if (
                input.dueDate()
                        .isBefore(
                                input.invoiceDate()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Invoice due date cannot be before the invoice date."
            );
        }

        validateUniqueLineNumbers(
                input.lines()
        );

        InvoiceRepository.PurchaseOrderRow purchaseOrder =
                repository
                        .findPurchaseOrder(
                                input.purchaseOrderId()
                        );

        if (purchaseOrder == null) {
            throw new ResourceNotFoundException(
                    "Purchase order not found: "
                            + input.purchaseOrderId()
            );
        }

        List<BigDecimal> lineTotals =
                input.lines()
                        .stream()
                        .map(
                                line ->
                                        calculationService
                                                .lineTotal(
                                                        line.quantity(),
                                                        line.unitPrice()
                                                )
                        )
                        .toList();

        BigDecimal subtotal =
                calculationService
                        .subtotal(
                                lineTotals
                        );

        BigDecimal total =
                calculationService
                        .total(
                                subtotal,
                                input.taxAmount()
                        );

        UUID invoiceId =
                UUID.randomUUID();

        repository.createInvoice(
                invoiceId,
                nextInvoiceNumber(),
                input,
                purchaseOrder,
                currentUserId,
                normalizeCurrency(
                        input.currency()
                ),
                subtotal,
                total
        );

        for (
                int index = 0;
                index < input.lines().size();
                index++
        ) {
            repository.createLine(
                    invoiceId,
                    input.lines()
                            .get(
                                    index
                            ),
                    lineTotals.get(
                            index
                    )
            );
        }

        runMatchInternal(
                invoiceId
        );

        return invoiceResponse(
                requireInvoice(
                        invoiceId
                )
        );
    }

    public InvoiceMatchResultResponse runMatch(
            UUID currentUserId,
            UUID invoiceId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvoiceRepository.InvoiceRow invoice =
                requireInvoice(
                        invoiceId
                );

        if (
                invoice.status()
                        != ProcurementInvoiceStatus.MATCH_PENDING
                &&
                invoice.status()
                        != ProcurementInvoiceStatus.MATCHED
                &&
                invoice.status()
                        != ProcurementInvoiceStatus.EXCEPTION
        ) {
            throw new IllegalArgumentException(
                    "Three-way matching is only available before invoice approval."
            );
        }

        runMatchInternal(
                invoiceId
        );

        InvoiceRepository.InvoiceRow updated =
                requireInvoice(
                        invoiceId
                );

        return new InvoiceMatchResultResponse(
                updated.status(),
                updated.matchStatus(),
                updated.openExceptions(),
                updated.paymentHold()
        );
    }

    public InvoiceMatchExceptionResponse resolveException(
            UUID currentUserId,
            UUID exceptionId,
            InvoiceDecisionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvoiceRepository.ExceptionRow exception =
                requireException(
                        exceptionId
                );

        if (
                exception.status()
                        != InvoiceExceptionStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open invoice exceptions can be resolved."
            );
        }

        repository.decideException(
                exceptionId,
                currentUserId,
                input.note(),
                InvoiceExceptionStatus.RESOLVED
        );

        repository.releaseExceptionInvoiceIfClear(
                exception.invoiceId()
        );

        return exceptionResponse(
                requireException(
                        exceptionId
                )
        );
    }

    public InvoiceMatchExceptionResponse dismissException(
            UUID currentUserId,
            UUID exceptionId,
            InvoiceDecisionInput input
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvoiceRepository.ExceptionRow exception =
                requireException(
                        exceptionId
                );

        if (
                exception.status()
                        != InvoiceExceptionStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open invoice exceptions can be dismissed."
            );
        }

        repository.decideException(
                exceptionId,
                currentUserId,
                input.note(),
                InvoiceExceptionStatus.DISMISSED
        );

        repository.releaseExceptionInvoiceIfClear(
                exception.invoiceId()
        );

        return exceptionResponse(
                requireException(
                        exceptionId
                )
        );
    }

    public ProcurementInvoiceResponse approveInvoice(
            UUID currentUserId,
            UUID invoiceId
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvoiceRepository.InvoiceRow invoice =
                requireInvoice(
                        invoiceId
                );

        if (
                invoice.status()
                        != ProcurementInvoiceStatus.MATCHED
        ) {
            throw new IllegalArgumentException(
                    "Only matched invoices can be approved."
            );
        }

        if (
                invoice.openExceptions() > 0
        ) {
            throw new IllegalArgumentException(
                    "Invoice has unresolved match exceptions."
            );
        }

        repository.approveInvoice(
                invoiceId,
                currentUserId
        );

        return invoiceResponse(
                requireInvoice(
                        invoiceId
                )
        );
    }

    public ProcurementInvoiceResponse holdPayment(
            UUID currentUserId,
            UUID invoiceId,
            InvoiceDecisionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvoiceRepository.InvoiceRow invoice =
                requireInvoice(
                        invoiceId
                );

        if (
                invoice.status()
                        != ProcurementInvoiceStatus.MATCHED
                &&
                invoice.status()
                        != ProcurementInvoiceStatus.APPROVED
                &&
                invoice.status()
                        != ProcurementInvoiceStatus.READY_FOR_PAYMENT
        ) {
            throw new IllegalArgumentException(
                    "This invoice cannot be placed on manual payment hold."
            );
        }

        repository.placePaymentHold(
                invoiceId,
                input.note()
        );

        return invoiceResponse(
                requireInvoice(
                        invoiceId
                )
        );
    }

    public ProcurementInvoiceResponse releasePaymentHold(
            UUID currentUserId,
            UUID invoiceId
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvoiceRepository.InvoiceRow invoice =
                requireInvoice(
                        invoiceId
                );

        if (
                invoice.status()
                        != ProcurementInvoiceStatus.PAYMENT_HOLD
        ) {
            throw new IllegalArgumentException(
                    "Invoice is not currently on payment hold."
            );
        }

        if (
                invoice.openExceptions() > 0
        ) {
            throw new IllegalArgumentException(
                    "Payment hold cannot be released while match exceptions remain open."
            );
        }

        repository.releasePaymentHold(
                invoiceId
        );

        return invoiceResponse(
                requireInvoice(
                        invoiceId
                )
        );
    }

    public ProcurementInvoiceResponse markReadyForPayment(
            UUID currentUserId,
            UUID invoiceId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvoiceRepository.InvoiceRow invoice =
                requireInvoice(
                        invoiceId
                );

        if (
                invoice.status()
                        != ProcurementInvoiceStatus.APPROVED
        ) {
            throw new IllegalArgumentException(
                    "Only approved invoices can become ready for payment."
            );
        }

        repository.markReadyForPayment(
                invoiceId
        );

        return invoiceResponse(
                requireInvoice(
                        invoiceId
                )
        );
    }

    public ProcurementInvoiceResponse markPaid(
            UUID currentUserId,
            UUID invoiceId
    ) {
        assertPaymentRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvoiceRepository.InvoiceRow invoice =
                requireInvoice(
                        invoiceId
                );

        if (
                invoice.status()
                        != ProcurementInvoiceStatus.READY_FOR_PAYMENT
        ) {
            throw new IllegalArgumentException(
                    "Only invoices ready for payment can be marked paid."
            );
        }

        repository.markPaid(
                invoiceId
        );

        return invoiceResponse(
                requireInvoice(
                        invoiceId
                )
        );
    }

    public ProcurementInvoiceResponse cancelInvoice(
            UUID currentUserId,
            UUID invoiceId,
            InvoiceDecisionInput input
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvoiceRepository.InvoiceRow invoice =
                requireInvoice(
                        invoiceId
                );

        if (
                invoice.status()
                        == ProcurementInvoiceStatus.PAID
        ) {
            throw new IllegalArgumentException(
                    "Paid invoices cannot be cancelled."
            );
        }

        repository.cancelInvoice(
                invoiceId,
                input.note()
        );

        return invoiceResponse(
                requireInvoice(
                        invoiceId
                )
        );
    }

    @Transactional(readOnly = true)
    public InvoiceSummaryResponse summary(
            UUID currentUserId,
            String currency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        String normalizedCurrency =
                normalizeCurrency(
                        currency
                );

        List<InvoiceRepository.InvoiceRow> invoices =
                repository
                        .findInvoices(
                                normalizedCurrency
                        );

        LocalDate today =
                LocalDate.now(
                        ZoneOffset.UTC
                );

        long matched =
                countStatus(
                        invoices,
                        ProcurementInvoiceStatus.MATCHED
                );

        long exception =
                countStatus(
                        invoices,
                        ProcurementInvoiceStatus.EXCEPTION
                );

        long approved =
                countStatus(
                        invoices,
                        ProcurementInvoiceStatus.APPROVED
                );

        long held =
                countStatus(
                        invoices,
                        ProcurementInvoiceStatus.PAYMENT_HOLD
                );

        long ready =
                countStatus(
                        invoices,
                        ProcurementInvoiceStatus.READY_FOR_PAYMENT
                );

        long overdue =
                invoices.stream()
                        .filter(
                                invoice ->
                                        invoice.status()
                                                != ProcurementInvoiceStatus.PAID
                                        &&
                                        invoice.status()
                                                != ProcurementInvoiceStatus.CANCELLED
                                        &&
                                        invoice.dueDate()
                                                .isBefore(
                                                        today
                                                )
                        )
                        .count();

        long openExceptions =
                invoices.stream()
                        .mapToLong(
                                InvoiceRepository.InvoiceRow::
                                        openExceptions
                        )
                        .sum();

        long duplicateExceptions =
                invoices.stream()
                        .flatMap(
                                invoice ->
                                        repository
                                                .findExceptions(
                                                        invoice.id()
                                                )
                                                .stream()
                        )
                        .filter(
                                item ->
                                        item.status()
                                                == InvoiceExceptionStatus.OPEN
                                        &&
                                        item.exceptionType()
                                                == InvoiceExceptionType.DUPLICATE_INVOICE
                        )
                        .count();

        BigDecimal apExposure =
                invoices.stream()
                        .filter(
                                invoice ->
                                        invoice.status()
                                                != ProcurementInvoiceStatus.PAID
                                        &&
                                        invoice.status()
                                                != ProcurementInvoiceStatus.CANCELLED
                        )
                        .map(
                                InvoiceRepository.InvoiceRow::
                                        totalAmount
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal heldExposure =
                invoices.stream()
                        .filter(
                                invoice ->
                                        invoice.paymentHold()
                                        &&
                                        invoice.status()
                                                != ProcurementInvoiceStatus.CANCELLED
                                )
                        .map(
                                InvoiceRepository.InvoiceRow::
                                        totalAmount
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal overdueExposure =
                invoices.stream()
                        .filter(
                                invoice ->
                                        invoice.status()
                                                != ProcurementInvoiceStatus.PAID
                                        &&
                                        invoice.status()
                                                != ProcurementInvoiceStatus.CANCELLED
                                        &&
                                        invoice.dueDate()
                                                .isBefore(
                                                        today
                                                )
                        )
                        .map(
                                InvoiceRepository.InvoiceRow::
                                        totalAmount
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        return new InvoiceSummaryResponse(
                normalizedCurrency,
                invoices.size(),
                matched,
                exception,
                approved,
                held,
                ready,
                overdue,
                openExceptions,
                duplicateExceptions,
                apExposure,
                heldExposure,
                overdueExposure
        );
    }

    @Transactional(readOnly = true)
    public InvoiceContextResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return new InvoiceContextResponse(
                repository.purchaseOrders()
        );
    }

    private void runMatchInternal(
            UUID invoiceId
    ) {
        InvoiceRepository.InvoiceRow invoice =
                requireInvoice(
                        invoiceId
                );

        InvoiceRepository.PurchaseOrderRow purchaseOrder =
                repository
                        .findPurchaseOrder(
                                invoice.purchaseOrderId()
                        );

        if (purchaseOrder == null) {
            throw new ResourceNotFoundException(
                    "Purchase order no longer exists for invoice."
            );
        }

        repository.resetOpenMatchingExceptions(
                invoiceId
        );

        List<InvoiceRepository.InvoiceExceptionCandidate> exceptions =
                new ArrayList<>();

        long duplicateCount =
                repository
                        .duplicateInvoiceCount(
                                invoiceId,
                                invoice.supplierId(),
                                invoice.supplierInvoiceNumber()
                        );

        if (duplicateCount > 0) {
            exceptions.add(
                    new InvoiceRepository.InvoiceExceptionCandidate(
                            InvoiceExceptionType.DUPLICATE_INVOICE,
                            InvoiceExceptionSeverity.CRITICAL,
                            null,
                            null,
                            null,
                            "Supplier invoice number "
                                    + invoice.supplierInvoiceNumber()
                                    + " already exists for this supplier."
                    )
            );
        }

        if (
                !invoice.currency()
                        .equalsIgnoreCase(
                                purchaseOrder.currency()
                        )
        ) {
            exceptions.add(
                    new InvoiceRepository.InvoiceExceptionCandidate(
                            InvoiceExceptionType.CURRENCY_MISMATCH,
                            InvoiceExceptionSeverity.CRITICAL,
                            null,
                            null,
                            null,
                            "Invoice currency "
                                    + invoice.currency()
                                    + " does not match purchase order currency "
                                    + purchaseOrder.currency()
                                    + "."
                    )
            );
        }

        if (
                "CANCELLED".equals(
                        purchaseOrder.status()
                )
        ) {
            exceptions.add(
                    new InvoiceRepository.InvoiceExceptionCandidate(
                            InvoiceExceptionType.PO_CANCELLED,
                            InvoiceExceptionSeverity.CRITICAL,
                            purchaseOrder.totalAmount(),
                            invoice.totalAmount(),
                            null,
                            "The referenced purchase order is cancelled."
                    )
            );
        }

        if (
                !"RECEIVED".equals(
                        purchaseOrder.status()
                )
        ) {
            InvoiceExceptionSeverity severity =
                    switch (
                            purchaseOrder.status()
                    ) {
                        case "PARTIALLY_RECEIVED" ->
                                InvoiceExceptionSeverity.MEDIUM;

                        case "ISSUED" ->
                                InvoiceExceptionSeverity.HIGH;

                        default ->
                                InvoiceExceptionSeverity.CRITICAL;
                    };

            exceptions.add(
                    new InvoiceRepository.InvoiceExceptionCandidate(
                            InvoiceExceptionType.RECEIPT_INCOMPLETE,
                            severity,
                            null,
                            null,
                            null,
                            "Three-way receipt match is incomplete because purchase order "
                                    + purchaseOrder.purchaseOrderNumber()
                                    + " is currently "
                                    + purchaseOrder.status()
                                    + "."
                    )
            );
        }

        BigDecimal otherInvoices =
                repository
                        .otherInvoicedValueForPo(
                                invoice.purchaseOrderId(),
                                invoiceId
                        );

        BigDecimal cumulative =
                otherInvoices
                        .add(
                                invoice.totalAmount()
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal allowed =
                calculationService
                        .allowedPurchaseOrderValue(
                                purchaseOrder.totalAmount(),
                                invoice.poVarianceTolerancePct()
                        );

        BigDecimal overInvoice =
                calculationService
                        .overInvoiceAmount(
                                cumulative,
                                allowed
                        );

        if (
                overInvoice.compareTo(
                        BigDecimal.ZERO
                ) > 0
        ) {
            InvoiceExceptionSeverity severity =
                    overInvoice.compareTo(
                            purchaseOrder
                                    .totalAmount()
                                    .multiply(
                                            new BigDecimal(
                                                    "0.10"
                                            )
                                    )
                    ) >= 0
                            ? InvoiceExceptionSeverity.CRITICAL
                            : InvoiceExceptionSeverity.HIGH;

            exceptions.add(
                    new InvoiceRepository.InvoiceExceptionCandidate(
                            InvoiceExceptionType.OVER_INVOICE,
                            severity,
                            allowed,
                            cumulative,
                            overInvoice,
                            "Cumulative invoice value "
                                    + cumulative
                                    + " exceeds purchase order value plus "
                                    + invoice.poVarianceTolerancePct()
                                    + "% tolerance."
                    )
            );
        }

        for (
                InvoiceRepository.InvoiceExceptionCandidate exception
                : exceptions
        ) {
            repository.upsertException(
                    invoiceId,
                    exception
            );
        }

        repository.updateMatchResult(
                invoiceId,
                exceptions.isEmpty()
        );
    }

    private ProcurementInvoiceResponse invoiceResponse(
            InvoiceRepository.InvoiceRow row
    ) {
        LocalDate today =
                LocalDate.now(
                        ZoneOffset.UTC
                );

        boolean overdue =
                row.status()
                        != ProcurementInvoiceStatus.PAID
                &&
                row.status()
                        != ProcurementInvoiceStatus.CANCELLED
                &&
                row.dueDate()
                        .isBefore(
                                today
                        );

        long agingDays =
                row.dueDate()
                        .isBefore(
                                today
                        )
                        ? ChronoUnit.DAYS
                                .between(
                                        row.dueDate(),
                                        today
                                )
                        : 0;

        BigDecimal remainingPoValue =
                row.purchaseOrderTotal()
                        .subtract(
                                row.cumulativeInvoicedValue()
                        )
                        .max(
                                BigDecimal.ZERO
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        return new ProcurementInvoiceResponse(
                row.id(),
                row.invoiceNumber(),
                row.supplierInvoiceNumber(),
                row.supplierId(),
                row.supplierCode(),
                row.supplierName(),
                row.purchaseOrderId(),
                row.purchaseOrderNumber(),
                row.purchaseOrderStatus(),
                row.purchaseOrderCurrency(),
                money(
                        row.purchaseOrderTotal()
                ),
                row.invoiceDate(),
                row.dueDate(),
                row.currency(),
                money(
                        row.subtotalAmount()
                ),
                money(
                        row.taxAmount()
                ),
                money(
                        row.totalAmount()
                ),
                row.poVarianceTolerancePct()
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),
                row.status(),
                row.matchStatus(),
                row.paymentHold(),
                row.holdReason(),
                row.approvedByName(),
                row.approvedAt(),
                row.readyForPaymentAt(),
                row.paidAt(),
                row.createdByUserId(),
                row.createdByName(),
                row.notes(),
                row.openExceptions(),
                overdue,
                agingDays,
                money(
                        row.cumulativeInvoicedValue()
                ),
                remainingPoValue,
                repository
                        .findLines(
                                row.id()
                        )
                        .stream()
                        .map(
                                line ->
                                        new ProcurementInvoiceLineResponse(
                                                line.id(),
                                                line.lineNumber(),
                                                line.description(),
                                                line.quantity(),
                                                line.unitPrice(),
                                                money(
                                                        line.lineTotal()
                                                )
                                        )
                        )
                        .toList(),
                repository
                        .findExceptions(
                                row.id()
                        )
                        .stream()
                        .map(
                                this::exceptionResponse
                        )
                        .toList(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private InvoiceMatchExceptionResponse exceptionResponse(
            InvoiceRepository.ExceptionRow row
    ) {
        return new InvoiceMatchExceptionResponse(
                row.id(),
                row.invoiceId(),
                row.exceptionType(),
                row.severity(),
                row.status(),
                moneyNullable(
                        row.expectedValue()
                ),
                moneyNullable(
                        row.actualValue()
                ),
                moneyNullable(
                        row.varianceAmount()
                ),
                row.details(),
                row.detectedAt(),
                row.lastCheckedAt(),
                row.resolutionNote(),
                row.resolvedAt(),
                row.resolvedByName(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private void validateUniqueLineNumbers(
            List<ProcurementInvoiceLineInput> lines
    ) {
        Set<Integer> numbers =
                new HashSet<>();

        for (
                ProcurementInvoiceLineInput line
                : lines
        ) {
            if (
                    !numbers.add(
                            line.lineNumber()
                    )
            ) {
                throw new IllegalArgumentException(
                        "Invoice line numbers must be unique."
                );
            }
        }
    }

    private InvoiceRepository.InvoiceRow requireInvoice(
            UUID invoiceId
    ) {
        InvoiceRepository.InvoiceRow invoice =
                repository
                        .findInvoice(
                                invoiceId
                        );

        if (invoice == null) {
            throw new ResourceNotFoundException(
                    "Procurement invoice not found: "
                            + invoiceId
            );
        }

        return invoice;
    }

    private InvoiceRepository.ExceptionRow requireException(
            UUID exceptionId
    ) {
        InvoiceRepository.ExceptionRow exception =
                repository
                        .findException(
                                exceptionId
                        );

        if (exception == null) {
            throw new ResourceNotFoundException(
                    "Invoice match exception not found: "
                            + exceptionId
            );
        }

        return exception;
    }

    private String nextInvoiceNumber() {
        Long sequence =
                repository
                        .nextInvoiceSequence();

        return String.format(
                "INV-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                sequence
        );
    }

    private long countStatus(
            List<InvoiceRepository.InvoiceRow> invoices,
            ProcurementInvoiceStatus status
    ) {
        return invoices.stream()
                .filter(
                        invoice ->
                                invoice.status()
                                        == status
                )
                .count();
    }

    private String normalizeCurrency(
            String currency
    ) {
        if (
                currency == null
                ||
                currency.trim()
                        .length()
                        != 3
        ) {
            throw new IllegalArgumentException(
                    "Invoice currency must contain exactly three characters."
            );
        }

        return currency
                .trim()
                .toUpperCase(
                        Locale.ROOT
                );
    }

    private BigDecimal money(
            BigDecimal value
    ) {
        return (
                value == null
                        ? BigDecimal.ZERO
                        : value
        )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal moneyNullable(
            BigDecimal value
    ) {
        return value == null
                ? null
                : value.setScale(
                        2,
                        RoundingMode.HALF_UP
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

    private void assertReadRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role != ProcurementRole.BUYER
                &&
                role != ProcurementRole.APPROVER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot access invoice control."
            );
        }
    }

    private void assertWriteRole(
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
                    "Your ProcureIQ role cannot manage procurement invoices."
            );
        }
    }

    private void assertApprovalRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role != ProcurementRole.APPROVER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot approve invoice exceptions or payment."
            );
        }
    }

    private void assertPaymentRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can mark invoices paid."
            );
        }
    }
}
