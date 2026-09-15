package com.procureiq.strategicalignment;

import java.util.List;

public record ObjectiveAlignmentDetailResponse(
        ObjectiveAlignmentSummaryResponse objective,
        List<AlignmentLinkResponse> links,
        List<AlignmentSourceResponse> candidateSources
) {
}
