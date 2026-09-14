package com.procureiq.supplieronboarding;

import java.time.Instant;
import java.util.UUID;

public record OnboardingApprovalResponse(
        UUID id,
        OnboardingApprovalLevel approvalLevel,
        boolean required,
        OnboardingApprovalStatus status,
        String decidedByName,
        String decisionNote,
        Instant decidedAt
) {
}
