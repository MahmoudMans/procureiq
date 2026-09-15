package com.procureiq.capitalrecycling;

import java.util.List;

public record CapitalRecyclingSourceDetailResponse(
        CapitalRecyclingSourceResponse source,
        List<CapitalRecyclingUserOptionResponse> users,
        List<CapitalReinvestmentTargetResponse> targets,
        List<CapitalReinvestmentProposalResponse> proposals
) {
}
