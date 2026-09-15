package com.procureiq.fundingexecution;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FundingReleaseResponse(
        UUID id,
        UUID trancheId,
        UUID authorizationId,
        BigDecimal releasedAmount,
        String releaseNote,
        String releasedByName,
        Instant releasedAt
) {
}
