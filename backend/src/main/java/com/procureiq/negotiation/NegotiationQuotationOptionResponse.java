package com.procureiq.negotiation;

import java.math.BigDecimal;
import java.util.UUID;

public record NegotiationQuotationOptionResponse(
        UUID id,
        String quotationReference,

        UUID rfqId,
        String rfqNumber,
        String rfqTitle,

        UUID supplierId,
        String supplierName,
        String supplierRiskLevel,

        String currency,
        BigDecimal totalAmount,
        String status
) {
}
