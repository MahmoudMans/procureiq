package com.procureiq.governancereview;

import java.util.List;

public record GovernanceReviewContextResponse(
        List<GovernanceReviewUserOptionResponse> users
) {
}
