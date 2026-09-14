package com.procureiq.reporting;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record PurchaseOrderReportRow(
        String poNumber,
        String supplierName,
        String status,
        BigDecimal totalAmount,
        LocalDate expectedDeliveryDate,
        Instant issuedAt
) {
}
