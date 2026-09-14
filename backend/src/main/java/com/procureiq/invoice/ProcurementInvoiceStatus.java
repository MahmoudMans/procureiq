package com.procureiq.invoice;

public enum ProcurementInvoiceStatus {
    MATCH_PENDING,
    MATCHED,
    EXCEPTION,
    APPROVED,
    PAYMENT_HOLD,
    READY_FOR_PAYMENT,
    PAID,
    CANCELLED
}
