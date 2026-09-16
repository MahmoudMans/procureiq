package com.procureiq.flywheelremediationoutcome;

import com.procureiq.flywheelremediation.FlywheelResidualRemediationAction;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelRemediationOutcomeItemResponse(
        UUID id,
        UUID outcomeCaseId,
        UUID sourceRemediationItemId,
        FlywheelResidualRemediationAction sourceAction,
        BigDecimal sourceResidualAmount,
        FlywheelRemediationResolutionType resolutionType,
        BigDecimal resolvedAmount,
        BigDecimal remainingResidualAmount,
        LocalDate observedOn,
        String evidenceReference,
        String evidenceNote,
        UUID createdByUserId,
        Instant createdAt
) {
}
