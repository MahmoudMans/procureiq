package com.procureiq.evaluation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record AwardDecisionResponse(
        UUID id,
        UUID rfqId,
        String rfqNumber,
        UUID selectedQuotationId,
        String selectedQuotationNumber,
        UUID selectedSupplierId,
        String selectedSupplierName,
        BigDecimal selectedTotalAmount,
        UUID recommendedQuotationId,
        String recommendedSupplierName,
        boolean manualOverride,
        String rationale,
        UUID decidedByUserId,
        String decidedByName,
        Instant decidedAt
) {
}
