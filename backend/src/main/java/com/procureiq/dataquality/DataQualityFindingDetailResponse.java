package com.procureiq.dataquality;

import java.util.List;

public record DataQualityFindingDetailResponse(
        DataQualityFindingResponse finding,
        List<DataQualityRemediationResponse> remediationTasks
) {
}
