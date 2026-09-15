package com.procureiq.capitalredeployment;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CapitalRedeploymentAuthorizationResponse(
        UUID id,
        UUID redeploymentCaseId,
        CapitalRedeploymentAuthorizationDecision decision,
        BigDecimal authorizedAmount,
        String authorizationNote,
        String authorizedByName,
        Instant authorizedAt
) {
}
