package com.procureiq.outcomepersistence;

import java.math.BigDecimal;
import java.util.UUID;

public record PersistenceReviewItemResponse(
        UUID planId,
        String planNumber,
        String commitmentNumber,
        String initiativeNumber,
        String initiativeTitle,
        String persistenceOwnerName,
        PersistencePlanStatus planStatus,
        BigDecimal baselineValidatedPoints,
        BigDecimal currentValidatedPoints,
        BigDecimal persistencePct,
        BigDecimal decayPoints,
        PersistenceHealth persistenceHealth,
        boolean observationDue,
        boolean verificationEligible,
        int openControlCount,
        int overdueControlCount,
        int observationCount,
        int verificationCount
) {
}
