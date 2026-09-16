package com.procureiq.flywheelremediationoutcome;

import com.procureiq.flywheelremediation.FlywheelResidualRemediationAction;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelRemediationOutcomeSnapshotItemResponse(
        UUID id,
        UUID snapshotId,
        UUID outcomeItemId,
        UUID sourceRemediationItemId,
        FlywheelResidualRemediationAction sourceAction,
        BigDecimal sourceResidualAmount,
        FlywheelRemediationResolutionType resolutionType,
        BigDecimal resolvedAmount,
        BigDecimal remainingResidualAmount,
        LocalDate observedOn,
        String evidenceReference,
        String evidenceNote
) {
}
