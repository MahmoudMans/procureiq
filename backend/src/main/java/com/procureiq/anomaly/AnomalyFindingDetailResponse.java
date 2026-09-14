package com.procureiq.anomaly;

import java.util.List;

public record AnomalyFindingDetailResponse(
        AnomalyFindingResponse finding,
        List<InvestigationResponse> investigations
) {
}
