package com.procureiq.fundingexecution;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record FundingTrancheResponse(
        UUID id,
        UUID commitmentId,
        String trancheNumber,
        int sequenceNo,
        String title,
        BigDecimal plannedReleaseAmount,
        LocalDate targetDate,
        FundingTrancheStatus status,
        String requestNote,
        String requestedByName,
        Instant requestedAt,
        int gateCount,
        int resolvedGateCount,
        int pendingGateCount,
        List<FundingGateResponse> gates,
        List<FundingAuthorizationResponse> authorizations,
        FundingReleaseResponse release,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
