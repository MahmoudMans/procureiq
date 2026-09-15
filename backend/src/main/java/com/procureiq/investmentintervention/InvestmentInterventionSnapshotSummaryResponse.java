package com.procureiq.investmentintervention;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record InvestmentInterventionSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        int caseCount,
        int openCaseCount,
        int inReviewCaseCount,
        int approvedCaseCount,
        int underperformingCaseCount,
        BigDecimal totalRemainingCapitalAmount,
        BigDecimal totalApprovedAffectedCapitalAmount,
        BigDecimal totalApprovedReallocationAmount,
        String capturedByName,
        Instant capturedAt
) {
}
