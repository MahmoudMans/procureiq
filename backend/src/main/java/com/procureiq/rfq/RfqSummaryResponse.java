package com.procureiq.rfq;

import java.math.BigDecimal;

public record RfqSummaryResponse(
        long totalRfqs,
        long draftRfqs,
        long publishedRfqs,
        long closedRfqs,
        long cancelledRfqs,
        long invitedSuppliers,
        BigDecimal activeSourcingValue
) {
}
