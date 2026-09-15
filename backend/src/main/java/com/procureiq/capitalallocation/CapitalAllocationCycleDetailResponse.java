package com.procureiq.capitalallocation;

import java.util.List;

public record CapitalAllocationCycleDetailResponse(
        CapitalAllocationCycleResponse cycle,
        List<CapitalAllocationCandidateResponse> candidates,
        List<CapitalAllocationItemResponse> items
) {
}
