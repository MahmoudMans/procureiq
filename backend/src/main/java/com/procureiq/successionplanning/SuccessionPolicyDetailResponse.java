package com.procureiq.successionplanning;

import com.procureiq.capabilityplanning.CapabilityWorkItemResponse;

import java.util.List;

public record SuccessionPolicyDetailResponse(
        SuccessionPolicyResponse policy,
        List<CapabilityWorkItemResponse> impactedWorkItems,
        List<SuccessionCandidateResponse> candidates
) {
}
