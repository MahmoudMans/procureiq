package com.procureiq.investmentintervention;

import java.math.BigDecimal;

public record InvestmentInterventionSummaryResponse(
        int candidateCount,
        int caseCount,
        int openCaseCount,
        int inReviewCaseCount,
        int approvedCaseCount,
        int underperformingCaseCount,
        BigDecimal totalRemainingCapitalAmount,
        BigDecimal totalApprovedAffectedCapitalAmount,
        BigDecimal totalApprovedReallocationAmount
) {
}
