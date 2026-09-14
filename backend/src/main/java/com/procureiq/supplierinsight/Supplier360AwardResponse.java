package com.procureiq.supplierinsight;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record Supplier360AwardResponse(
        UUID rfqId,
        String rfqNumber,
        UUID quotationId,
        String quotationNumber,
        BigDecimal awardValue,
        boolean manualOverride,
        Instant decidedAt
) {
}
