package com.procureiq.invoice;

import java.math.BigDecimal;

public record InvoiceSummaryResponse(
        String currency,
        long totalInvoices,
        long matchedInvoices,
        long exceptionInvoices,
        long approvedInvoices,
        long heldInvoices,
        long readyForPaymentInvoices,
        long overdueInvoices,
        long openExceptions,
        long duplicateExceptions,
        BigDecimal accountsPayableExposure,
        BigDecimal paymentHoldExposure,
        BigDecimal overdueExposure
) {
}
