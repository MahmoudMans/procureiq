package com.procureiq.investmentintervention;

import java.util.List;

public record InvestmentInterventionSnapshotDetailResponse(
        InvestmentInterventionSnapshotSummaryResponse snapshot,
        List<InvestmentInterventionSnapshotItemResponse> items
) {
}
