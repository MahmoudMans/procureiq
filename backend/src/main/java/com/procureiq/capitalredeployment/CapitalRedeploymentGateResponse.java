package com.procureiq.capitalredeployment;

import java.time.Instant;
import java.util.UUID;

public record CapitalRedeploymentGateResponse(
        UUID id,
        UUID redeploymentCaseId,
        String gateNumber,
        String title,
        String requirement,
        CapitalRedeploymentGateStatus status,
        String evidenceNote,
        String decisionNote,
        String decidedByName,
        Instant decidedAt,
        Instant createdAt
) {
}
