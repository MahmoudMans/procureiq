package com.procureiq.rfq;

import java.math.BigDecimal;
import java.util.UUID;

public record RfqLineItemResponse(
        UUID id,
        int lineNumber,
        String itemName,
        String description,
        String category,
        BigDecimal quantity,
        String unit
) {
}
