package com.procureiq.demandconsolidation;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record DemandBundleResponse(
        UUID id,
        String bundleNumber,
        String title,
        String category,
        String currency,

        DemandBundleStatus status,
        LocalDate targetSourcingDate,

        BigDecimal consolidatedValue,
        BigDecimal expectedLeveragePct,
        BigDecimal expectedSavings,

        int intakeCount,
        int departmentCount,

        UUID ownerUserId,
        String ownerName,

        String rationale,

        String decisionNote,
        Instant decidedAt,
        String decidedByName,

        UUID linkedRfqId,
        String linkedRfqNumber,
        String linkedRfqTitle,
        String linkedRfqStatus,

        Instant sourcingStartedAt,
        Instant closedAt,

        List<DemandBundleItemResponse> items,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
