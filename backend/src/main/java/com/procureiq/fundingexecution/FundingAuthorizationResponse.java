package com.procureiq.fundingexecution;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FundingAuthorizationResponse(
        UUID id,
        UUID trancheId,
        FundingAuthorizationDecision decision,
        BigDecimal authorizedAmount,
        String authorizationNote,
        String authorizedByName,
        Instant authorizedAt
) {
}
