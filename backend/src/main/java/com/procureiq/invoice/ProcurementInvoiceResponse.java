package com.procureiq.invoice;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ProcurementInvoiceResponse(
        UUID id,
        String invoiceNumber,
        String supplierInvoiceNumber,

        UUID supplierId,
        String supplierCode,
        String supplierName,

        UUID purchaseOrderId,
        String purchaseOrderNumber,
        String purchaseOrderStatus,
        String purchaseOrderCurrency,
        BigDecimal purchaseOrderTotal,

        LocalDate invoiceDate,
        LocalDate dueDate,

        String currency,

        BigDecimal subtotalAmount,
        BigDecimal taxAmount,
        BigDecimal totalAmount,

        BigDecimal poVarianceTolerancePct,

        ProcurementInvoiceStatus status,
        InvoiceMatchStatus matchStatus,

        boolean paymentHold,
        String holdReason,

        String approvedByName,
        Instant approvedAt,
        Instant readyForPaymentAt,
        Instant paidAt,

        UUID createdByUserId,
        String createdByName,

        String notes,

        long openExceptions,
        boolean overdue,
        long agingDays,

        BigDecimal cumulativeInvoicedValue,
        BigDecimal remainingPoValue,

        List<ProcurementInvoiceLineResponse> lines,
        List<InvoiceMatchExceptionResponse> exceptions,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
