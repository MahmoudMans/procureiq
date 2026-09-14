package com.procureiq.governancereview;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record GovernanceReviewUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
