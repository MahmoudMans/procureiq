package com.procureiq.capitalredeployment;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record CapitalRedeploymentReleaseResponse(
        UUID id,
        UUID redeploymentCaseId,
        UUID authorizationId,
        LocalDate releasedOn,
        BigDecimal releasedAmount,
        String evidenceNote,
        String referenceText,
        String releasedByName,
        Instant releasedAt
) {
}
