package com.procureiq.invoice;

public record InvoiceMatchResultResponse(
        ProcurementInvoiceStatus invoiceStatus,
        InvoiceMatchStatus matchStatus,
        long openExceptions,
        boolean paymentHold
) {
}
