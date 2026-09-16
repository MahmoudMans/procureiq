package com.procureiq.flywheelremediationoutcome;

import com.procureiq.flywheelremediation.FlywheelResidualRemediationAction;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelRemediationOutcomeCandidateResponse(
        UUID remediationItemId,
        FlywheelResidualRemediationAction sourceAction,
        BigDecimal sourceResidualAmount
) {
}
