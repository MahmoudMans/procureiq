package com.procureiq.outcomepersistence;

import java.math.BigDecimal;

public record PersistenceMetricResult(
        BigDecimal persistencePct,
        BigDecimal decayPoints,
        PersistenceHealth health
) {
}
