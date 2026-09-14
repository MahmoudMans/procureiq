package com.procureiq.quotation;

import java.math.BigDecimal;
import java.util.UUID;

public record QuotationLineResponse(
        UUID id,
        UUID rfqLineItemId,
        int lineNumber,
        String itemName,
        String category,
        BigDecimal quantity,
        String unit,
        BigDecimal unitPrice,
        BigDecimal lineSubtotal
) {
}
