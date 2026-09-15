package com.procureiq.investmentintervention;

import java.util.List;

public record InvestmentInterventionDashboardResponse(
        InvestmentInterventionSummaryResponse summary,
        List<InvestmentInterventionUserOptionResponse> users,
        List<InvestmentInterventionCandidateResponse> candidates,
        List<InvestmentInterventionCaseResponse> cases,
        List<InvestmentInterventionSnapshotSummaryResponse> snapshots
) {
}
