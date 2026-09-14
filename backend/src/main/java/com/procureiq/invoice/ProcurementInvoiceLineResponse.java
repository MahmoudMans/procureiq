package com.procureiq.invoice;

import java.math.BigDecimal;
import java.util.UUID;

public record ProcurementInvoiceLineResponse(
        UUID id,
        int lineNumber,
        String description,
        BigDecimal quantity,
        BigDecimal unitPrice,
        BigDecimal lineTotal
) {
}
