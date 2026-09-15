package com.procureiq.outcomepersistence;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PersistenceVerificationResponse(
        UUID id,
        UUID planId,
        PersistenceVerificationDecision decision,
        BigDecimal persistencePct,
        BigDecimal decayPoints,
        PersistenceHealth persistenceHealth,
        String verificationNote,
        String verifiedByName,
        Instant verifiedAt
) {
}
