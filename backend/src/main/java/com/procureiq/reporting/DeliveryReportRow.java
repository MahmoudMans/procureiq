package com.procureiq.reporting;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DeliveryReportRow(
        String poNumber,
        String supplierName,
        String status,
        LocalDate expectedDeliveryDate,
        LocalDate lastReceiptDate,
        BigDecimal orderedQuantity,
        BigDecimal receivedQuantity,
        BigDecimal fulfillmentRate,
        boolean late
) {
}
