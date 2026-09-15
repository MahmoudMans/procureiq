package com.procureiq.capitalflywheel;

import java.util.List;

public record CapitalFlywheelLineageDetailResponse(
        CapitalFlywheelLineageResponse lineage,
        List<CapitalFlywheelUserOptionResponse> users,
        List<CapitalFlywheelCandidateResponse> availableCandidates,
        List<CapitalFlywheelCycleResponse> cycles,
        List<CapitalFlywheelReviewResponse> reviews
) {
}
