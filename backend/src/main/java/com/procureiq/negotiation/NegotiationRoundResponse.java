package com.procureiq.negotiation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record NegotiationRoundResponse(
        UUID id,
        UUID workspaceId,
        int roundNumber,
        NegotiationRoundSide actorSide,
        BigDecimal offerValue,
        int paymentTermsDays,
        int leadTimeDays,
        int warrantyMonths,
        Integer volumeCommitment,
        String notes,
        UUID createdByUserId,
        String createdByName,
        Instant roundAt,
        Instant createdAt
) {
}
