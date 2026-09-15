package com.procureiq.fundingexecution;

import java.time.Instant;
import java.util.UUID;

public record FundingGateResponse(
        UUID id,
        UUID trancheId,
        String title,
        String requirement,
        FundingGateStatus status,
        String evidenceNote,
        String decisionNote,
        String decidedByName,
        Instant decidedAt,
        Instant createdAt
) {
}
